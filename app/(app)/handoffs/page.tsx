"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { mergeHandoffTranscript } from "@/lib/handoff-transcript";
import PageFrame from "@/components/PageFrame";
import PageHeader from "@/components/PageHeader";
import { isValidHandoffStatus } from "@/lib/handoff-resolution";

type Handoff = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  reason: string;
  latest_message: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
  archived_at?: string | null;
  latest_human_message_at?: string | null;
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
type InboxView = "active" | "resolved" | "archived";
type InboxCounts = { open: number; in_progress: number; waiting_for_customer: number; resolved: number };
const EMPTY_COUNTS: InboxCounts = { open: 0, in_progress: 0, waiting_for_customer: 0, resolved: 0 };

export default function HandoffsPage() {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [selected, setSelected] = useState<Handoff | null>(null);
  const selectedConversationId = selected?.id;
  const [messages, setMessages] = useState<HandoffMessage[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<InboxView>("active");
  const [counts, setCounts] = useState<InboxCounts>(EMPTY_COUNTS);
  const [archivedCount, setArchivedCount] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [seenAt, setSeenAt] = useState<Record<string, string>>({});
  const listRequestPending = useRef(false);
  const queuedListRefresh = useRef(false);
  const latestLoad = useRef<(showLoading?: boolean, signal?: AbortSignal) => Promise<void>>(async () => {});
  const detailRequestPending = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  const detailPanelRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async (showLoading = false, signal?: AbortSignal) => {
    if (listRequestPending.current) {
      queuedListRefresh.current = true;
      return;
    }
    listRequestPending.current = true;
    if (showLoading) setLoading(true);
    try {
      const response = await fetch(`/api/handoffs?view=${view}&page=${page}`, { signal });
      if (signal?.aborted) return;
      if (!response.ok) {
        setError("Unable to load support requests.");
        return;
      }
      const payload = await response.json() as {
        handoffs?: Handoff[];
        counts?: InboxCounts;
        archivedCount?: number;
        hasMore?: boolean;
      };
      const nextHandoffs = payload.handoffs ?? [];
      setHandoffs(nextHandoffs);
      setCounts(payload.counts ?? EMPTY_COUNTS);
      setArchivedCount(payload.archivedCount ?? 0);
      setHasMore(payload.hasMore ?? false);
      const seenUpdates: Record<string, string> = {};
      for (const handoff of nextHandoffs) {
        const stored = localStorage.getItem(`supportai:handoff-seen:${handoff.id}`);
        if (stored) seenUpdates[handoff.id] = stored;
      }
      setSeenAt((current) => ({ ...current, ...seenUpdates }));
      setError("");
    } catch {
      if (!signal?.aborted) setError("Unable to load support requests.");
    } finally {
      listRequestPending.current = false;
      if (!signal?.aborted) setLoading(false);
      if (queuedListRefresh.current) {
        queuedListRefresh.current = false;
        window.setTimeout(() => void latestLoad.current(), 0);
      }
    }
  }, [page, view]);

  useEffect(() => { latestLoad.current = load; }, [load]);

  const select = useCallback(async (handoff: Handoff) => {
    setSelected(handoff);
    selectedIdRef.current = handoff.id;
    try {
      const response = await fetch(`/api/handoffs/${handoff.id}`);
      if (!response.ok) throw new Error("Unable to load the support conversation.");
      const payload = await response.json() as {
        handoff?: { transcript?: Array<{ role: "user" | "assistant"; content: string; created_at?: string }> };
        messages?: PersistedHandoffMessage[];
      };
      if (selectedIdRef.current === handoff.id) {
        setMessages(mergeHandoffTranscript(payload.handoff?.transcript ?? [], payload.messages ?? []));
        const newestHuman = (payload.messages ?? []).filter((item) => item.role === "human")
          .reduce<string | null>((latest, item) => !latest || item.created_at > latest ? item.created_at : latest, null);
        if (newestHuman) {
          localStorage.setItem(`supportai:handoff-seen:${handoff.id}`, newestHuman);
          setSeenAt((current) => ({ ...current, [handoff.id]: newestHuman }));
        }
      }
    } catch {
      setError("Unable to load the support conversation.");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initial = window.setTimeout(() => void load(true, controller.signal), 0);
    const refresh = () => { if (document.visibilityState === "visible") void load(false, controller.signal); };
    const timer = window.setInterval(refresh, 7000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(initial);
      queuedListRefresh.current = false;
      controller.abort();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  useEffect(() => {
    const id = selected?.id;
    if (!id) return;
    let stopped = false;
    const refreshDetail = async () => {
      if (stopped || detailRequestPending.current || document.visibilityState !== "visible") return;
      detailRequestPending.current = true;
      try {
        const response = await fetch(`/api/handoffs/${id}`);
        if (!response.ok) return;
        const payload = await response.json() as {
          handoff?: { transcript?: Array<{ role: "user" | "assistant"; content: string; created_at?: string }> };
          messages?: PersistedHandoffMessage[];
        };
        if (!stopped && selectedIdRef.current === id) {
          setMessages(mergeHandoffTranscript(payload.handoff?.transcript ?? [], payload.messages ?? []));
          const newestHuman = (payload.messages ?? []).filter((item) => item.role === "human")
            .reduce<string | null>((latest, item) => !latest || item.created_at > latest ? item.created_at : latest, null);
          if (newestHuman) {
            localStorage.setItem(`supportai:handoff-seen:${id}`, newestHuman);
            setSeenAt((current) => ({ ...current, [id]: newestHuman }));
          }
        }
      } catch {
        if (!stopped) setError("Unable to refresh the selected support conversation.");
      } finally {
        detailRequestPending.current = false;
      }
    };
    const timer = window.setInterval(() => void refreshDetail(), 7000);
    const onVisibility = () => { if (document.visibilityState === "visible") void refreshDetail(); };
    window.addEventListener("focus", onVisibility);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [selected?.id]);

  useEffect(() => {
    if (selectedConversationId && window.matchMedia("(max-width: 1023px)").matches) {
      detailPanelRef.current?.scrollIntoView({ block: "start" });
    }
  }, [selectedConversationId]);

  const updateStatus = async (status: string) => {
    if (!selected || saving || !isValidHandoffStatus(status)) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/handoffs/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => null) as {
        error?: string;
        handoff?: { id: string; status: string; updated_at: string };
      } | null;
      if (!response.ok || !payload?.handoff || !isValidHandoffStatus(payload.handoff.status)) {
        setError(payload?.error || "Unable to update the support request.");
        return;
      }
      const savedStatus = payload.handoff.status;
      setSelected((current) => current?.id === selected.id ? { ...current, status: savedStatus } : current);
      setHandoffs((items) => items.map((item) => item.id === selected.id ? { ...item, status: savedStatus } : item));
      await load();
    } catch {
      setError("Unable to update the support request.");
    } finally {
      setSaving(false);
    }
  };

  const setArchived = async (handoff: Handoff, archived: boolean) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/handoffs/${handoff.id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error || "Unable to update the archive status.");
        return;
      }
      await load();
      setSelected((current) => current?.id === handoff.id
        ? { ...current, archived_at: archived ? new Date().toISOString() : null }
        : current);
    } catch {
      setError("Unable to update the archive status.");
    } finally {
      setSaving(false);
    }
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
        <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Support inbox views">
          {(["active", "resolved", "archived"] as const).map((item) => (
            <button key={item} type="button" onClick={() => { setPage(0); setView(item); }} aria-pressed={view === item}
              className={`min-h-10 rounded-[var(--radius-control)] border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] ${view === item ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"}`}>
              {item === "active" ? `Active (${counts.open + counts.in_progress + counts.waiting_for_customer})` : item === "resolved" ? `Resolved (${counts.resolved})` : `Archived (${archivedCount})`}
            </button>
          ))}
          <span className="ml-auto text-xs text-[var(--text-secondary)]">Updates automatically every 7 seconds</span>
        </div>
        {error && <p role="alert" className="mb-5 rounded-lg border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[var(--error-soft)] p-3 text-sm text-[var(--error)]">{error}</p>}
        {loading ? <p className="text-sm text-[var(--text-secondary)]">Loading support requests…</p> : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
            <section aria-label="Support requests" className={`${selected ? "hidden lg:block" : ""} min-w-0 space-y-2`}>
              {handoffs.length === 0 && error && <button type="button" onClick={() => void load(true)} className="surface w-full rounded-xl border-dashed p-8 text-left text-sm text-[var(--text-secondary)]">Could not load the inbox. Retry.</button>}
              {handoffs.length === 0 && !error && <p className="surface rounded-xl border-dashed p-8 text-sm text-[var(--text-secondary)]">{view === "active" ? "No active support requests." : view === "resolved" ? "No resolved support requests." : "No archived support requests."}</p>}
              {handoffs.map((handoff) => (
                <button key={handoff.id} type="button" onClick={() => void select(handoff)}
                  aria-pressed={selected?.id === handoff.id}
                  className={`surface w-full rounded-lg p-3 text-left transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] ${selected?.id === handoff.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <strong className="truncate text-sm text-[var(--text-primary)]">{handoff.customer_name || "Website visitor"}</strong>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--text-secondary)]">
                      {handoff.latest_human_message_at && handoff.latest_human_message_at > (seenAt[handoff.id] ?? "") && <span className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 font-semibold text-[var(--success)]">New reply</span>}
                      {handoff.archived_at ? "Archived" : STATUS_LABELS[handoff.status] || handoff.status}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-[var(--text-secondary)]">{handoff.reason}</p>
                  <time className="mt-1 block text-xs text-[var(--text-secondary)]">{new Date(handoff.created_at).toLocaleString()}</time>
                </button>
              ))}
          {(page > 0 || hasMore) && <div className="flex justify-between pt-2">
            <button type="button" disabled={page === 0 || loading} onClick={() => setPage((current) => Math.max(0, current - 1))} className="min-h-9 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
            <span className="self-center text-xs text-[var(--text-secondary)]">Page {page + 1}</span>
            <button type="button" disabled={!hasMore || loading} onClick={() => setPage((current) => current + 1)} className="min-h-9 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50">Next</button>
          </div>}
            </section>
            <section ref={detailPanelRef} aria-label="Support conversation detail" className={`${selected ? "" : "hidden lg:block"} surface min-w-0 scroll-mt-3 rounded-xl p-4 sm:p-5`}>
              {!selected ? <p className="text-sm text-[var(--text-secondary)]">Select a request to view its context.</p> : (
                <>
                  <button type="button" onClick={() => { setSelected(null); selectedIdRef.current = null; }} className="mb-3 min-h-10 rounded-lg px-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] lg:hidden">← Back to inbox</button>
                  <div className="border-b border-[var(--border)] pb-4">
                    <h2 className="font-semibold text-[var(--text-primary)]">{selected.customer_name || "Website visitor"}</h2>
                    {selected.customer_email && <a className="text-sm text-[var(--accent)] underline" href={`mailto:${selected.customer_email}`}>{selected.customer_email}</a>}
                    <p className="mt-3 text-sm text-[var(--text-secondary)]"><strong>Reason:</strong> {selected.reason}</p>
                    <select value={selected.status} disabled={saving || selected.status === "resolved"} onChange={(event) => void updateStatus(event.target.value)}
                      className="mt-3 min-h-10 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20">
                      {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    {selected.status === "resolved" && <p className="mt-2 text-xs text-[var(--text-secondary)]">Resolved requests are final and cannot be reopened.</p>}
                    {selected.status === "resolved" && !selected.archived_at && <button type="button" disabled={saving} onClick={() => void setArchived(selected, true)} className="mt-3 min-h-10 rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving…" : "Archive"}</button>}
                    {selected.archived_at && <button type="button" disabled={saving} onClick={() => void setArchived(selected, false)} className="mt-3 min-h-10 rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving…" : "Restore to resolved"}</button>}
                    {selected.status === "resolved" && <Link href={`/history?type=handoff&id=${encodeURIComponent(selected.id)}${selected.archived_at ? "&archived=all" : ""}`} className="ml-3 inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--accent-link)] transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">View in Chat History</Link>}
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
                    <textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={8000} rows={3} placeholder="Write a reply…" className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none transition focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20" />
                    <button type="button" onClick={() => void sendReply()} disabled={saving || !reply.trim()} className="min-h-10 self-end rounded-[var(--radius-control)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50">Reply</button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
    </PageFrame>
  );
}
