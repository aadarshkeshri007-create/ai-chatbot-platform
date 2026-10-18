"use client";

import { useEffect, useState } from "react";
import { mergeHandoffTranscript } from "@/lib/handoff-transcript";
import PageFrame from "@/components/PageFrame";
import PageHeader from "@/components/PageHeader";

type Handoff = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  reason: string;
  latest_message: string | null;
  status: string;
  created_at: string;
};
type HandoffMessage = {
  id: string;
  role: "customer" | "human" | "assistant";
  content: string;
  created_at: string;
};
type PersistedHandoffMessage = {
  id: string;
  role: "customer" | "human";
  content: string;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_for_customer: "Waiting for customer",
  resolved: "Resolved",
};

export default function HandoffsPage() {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [selected, setSelected] = useState<Handoff | null>(null);
  const [messages, setMessages] = useState<HandoffMessage[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError("");
    const response = await fetch("/api/handoffs");
    if (!response.ok) {
      setError("Unable to load support requests.");
      setLoading(false);
      return;
    }
    const payload = await response.json() as { handoffs?: Handoff[] };
    setHandoffs(payload.handoffs ?? []);
    setLoading(false);
  };

  const select = async (handoff: Handoff) => {
    setSelected(handoff);
    const response = await fetch(`/api/handoffs/${handoff.id}`);
    if (!response.ok) {
      setError("Unable to load the support conversation.");
      return;
    }
    const payload = await response.json() as {
      handoff?: { transcript?: Array<{ role: "user" | "assistant"; content: string; created_at?: string }> };
      messages?: PersistedHandoffMessage[];
    };
    setMessages(mergeHandoffTranscript(payload.handoff?.transcript ?? [], payload.messages ?? []));
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const updateStatus = async (status: string) => {
    if (!selected) return;
    setSaving(true);
    const response = await fetch(`/api/handoffs/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSaving(false);
    if (!response.ok) {
      setError("Unable to update the support request.");
      return;
    }
    setSelected({ ...selected, status });
    setHandoffs((items) => items.map((item) => item.id === selected.id ? { ...item, status } : item));
  };

  const sendReply = async () => {
    if (!selected || !reply.trim() || saving) return;
    setSaving(true);
    const response = await fetch(`/api/handoffs/${selected.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: reply.trim() }),
    });
    setSaving(false);
    if (!response.ok) {
      setError("Unable to save the reply.");
      return;
    }
    const payload = await response.json() as { message?: HandoffMessage };
    if (payload.message) setMessages((items) => [...items, payload.message as HandoffMessage]);
    setReply("");
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Human support"
        title="Support inbox"
        description="Respond to customers who asked to talk with a human and keep every handoff in context."
      />
        {error && <p role="alert" className="mb-5 rounded-lg border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] p-3 text-sm text-[var(--error)]">{error}</p>}
        {loading ? <p className="text-sm text-slate-500">Loading support requests…</p> : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
            <section className="space-y-3">
              {handoffs.length === 0 && <p className="surface rounded-xl border-dashed p-8 text-sm text-[var(--text-secondary)]">No support requests yet.</p>}
              {handoffs.map((handoff) => (
                <button key={handoff.id} type="button" onClick={() => void select(handoff)}
                  className={`surface w-full rounded-xl p-4 text-left transition-colors hover:border-[var(--accent)] ${selected?.id === handoff.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <strong className="truncate text-sm text-slate-900 dark:text-slate-100">{handoff.customer_name || "Website visitor"}</strong>
                    <span className="text-xs text-slate-500">{STATUS_LABELS[handoff.status] || handoff.status}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{handoff.reason}</p>
                  <time className="mt-2 block text-xs text-slate-400">{new Date(handoff.created_at).toLocaleString()}</time>
                </button>
              ))}
            </section>
            <section className="surface rounded-xl p-5">
              {!selected ? <p className="text-sm text-[var(--text-secondary)]">Select a request to view its context.</p> : (
                <>
                  <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
                    <h2 className="font-semibold text-slate-900 dark:text-slate-100">{selected.customer_name || "Website visitor"}</h2>
                    {selected.customer_email && <a className="text-sm text-teal-700 underline" href={`mailto:${selected.customer_email}`}>{selected.customer_email}</a>}
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300"><strong>Reason:</strong> {selected.reason}</p>
                    <select value={selected.status} disabled={saving} onChange={(event) => void updateStatus(event.target.value)}
                      className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                      {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <div className="max-h-[420px] space-y-3 overflow-y-auto py-4">
                    {messages.map((message) => (
                      <div key={message.id} className={`rounded-lg border p-3 text-sm ${message.role === "human" ? "ml-8 border-[color-mix(in_srgb,var(--success)_25%,var(--border))] bg-[color-mix(in_srgb,var(--success)_10%,var(--surface))] text-[var(--text-primary)]" : "mr-8 border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-primary)]"}`}>
                        <strong className="block text-xs uppercase tracking-wide">{message.role === "human" ? "Human reply" : message.role === "assistant" ? "AI context" : "Customer context"}</strong>
                        <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={8000} rows={3} placeholder="Write a reply…" className="min-w-0 flex-1 rounded-lg border border-slate-300 p-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                    <button type="button" onClick={() => void sendReply()} disabled={saving || !reply.trim()} className="self-end rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Reply</button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
    </PageFrame>
  );
}
