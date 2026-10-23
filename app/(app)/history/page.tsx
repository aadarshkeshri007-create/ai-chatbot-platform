"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import MessageContent from "@/components/chat/MessageContent";
import PageFrame from "@/components/PageFrame";
import PageHeader from "@/components/PageHeader";
import { shouldRenderAsMarkdown } from "@/lib/markdown-content";

type HistoryItem = {
  id: string; kind: "ai" | "handoff" | "mixed"; handoffId?: string; title: string; customer: string;
  status: string; firstActivityAt: string; lastActivityAt: string; preview: string; archived: boolean;
};
type HistoryMessage = { id: string; role: string; content: string; created_at: string; sources?: Array<{ label: string; chunk_index?: number }> };
type Detail = { conversation?: { title?: string }; handoff?: Record<string, unknown> | null; messages: HistoryMessage[] };

const STATUS_LABELS: Record<string, string> = {
  open: "Open", in_progress: "In progress", waiting_for_customer: "Waiting for customer", resolved: "Resolved", all: "AI chat",
};

function dateLabel(value: string) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const selectedConversationId = selected?.id;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");
  const [archived, setArchived] = useState("active");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const openedQueryId = useRef("");
  const detailRequestVersion = useRef(0);
  const detailPanelRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, from, to, status, kind, archived, page: String(page), pageSize: "25" });
      const response = await fetch(`/api/history?${params}`, { signal });
      const payload = await response.json().catch(() => null) as { error?: string; items?: HistoryItem[]; total?: number } | null;
      if (!response.ok || !payload?.items) throw new Error(payload?.error || "Unable to load conversation history.");
      setItems(payload.items);
      setTotal(payload.total ?? 0);
      setError("");
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load conversation history.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [archived, from, kind, page, search, status, to]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), search ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, search]);

  const openDetail = useCallback(async (item: HistoryItem, initialHandoffId?: string) => {
    const requestVersion = ++detailRequestVersion.current;
    setSelected(item);
    setDetail(null);
    setDetailLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ kind: item.kind, id: item.id });
      const handoffId = initialHandoffId || item.handoffId;
      if (handoffId) params.set("handoffId", handoffId);
      let response = await fetch(`/api/history/detail?${params}`);
      let payload = await response.json().catch(() => null) as (Detail & { error?: string; redirectKind?: string; id?: string; handoffId?: string }) | null;
      if (response.ok && payload?.redirectKind === "mixed" && payload.id && payload.handoffId) {
        const redirected = new URLSearchParams({ kind: "mixed", id: payload.id, handoffId: payload.handoffId });
        response = await fetch(`/api/history/detail?${redirected}`);
        payload = await response.json().catch(() => null) as (Detail & { error?: string }) | null;
      }
      if (!response.ok || !payload || !Array.isArray(payload.messages)) throw new Error(payload?.error || "Unable to load this history item.");
      if (requestVersion === detailRequestVersion.current) setDetail(payload);
    } catch (loadError) {
      if (requestVersion === detailRequestVersion.current) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load this history item.");
      }
    } finally {
      if (requestVersion === detailRequestVersion.current) setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const handoffId = params.get("id");
    if (!handoffId) return;
    const includeArchived = params.get("archived") === "all";
    if (includeArchived && archived !== "all") {
      window.setTimeout(() => setArchived("all"), 0);
      return;
    }
    if (openedQueryId.current === handoffId) return;
    const item = items.find((entry) => entry.id === handoffId || entry.handoffId === handoffId);
    if (item) {
      openedQueryId.current = handoffId;
      window.setTimeout(() => void openDetail(item, handoffId), 0);
    }
    else if (!loading && !error) window.setTimeout(() => setError("That support request is not in the current history filter. Clear filters to open it."), 0);
  }, [archived, error, items, loading, openDetail]);

  const setHandoffArchived = async (archive: boolean) => {
    const handoffId = selected?.handoffId || (selected?.kind === "handoff" ? selected.id : null);
    if (!handoffId || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/handoffs/${handoffId}/archive`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: archive }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Unable to update the archive status.");
      await load();
      setSelected((current) => current ? { ...current, archived: archive } : current);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update the archive status.");
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearch(""); setFrom(""); setTo(""); setStatus("all"); setKind("all"); setArchived("all"); setPage(0);
  };

  useEffect(() => {
    if (selectedConversationId && window.matchMedia("(max-width: 1023px)").matches) {
      detailPanelRef.current?.scrollIntoView({ block: "start" });
    }
  }, [selectedConversationId]);

  return (
    <PageFrame>
      <PageHeader eyebrow="Conversations" title="Chat history" description="Search persisted assistant chats and human support handoffs." />
      <section className={`${selected ? "hidden lg:block" : ""} surface mb-6 rounded-xl p-4`} aria-label="History filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="text-xs font-medium text-[var(--text-secondary)] lg:col-span-2">Search messages or customer
            <input value={search} onChange={(event) => { setPage(0); setSearch(event.target.value); }} placeholder="Name, email, or message" className="mt-1 block min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)]" />
          </label>
          <label className="text-xs font-medium text-[var(--text-secondary)]">From
            <input type="date" value={from} onChange={(event) => { setPage(0); setFrom(event.target.value); }} className="mt-1 block min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--text-primary)]" />
          </label>
          <label className="text-xs font-medium text-[var(--text-secondary)]">To
            <input type="date" value={to} onChange={(event) => { setPage(0); setTo(event.target.value); }} className="mt-1 block min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--text-primary)]" />
          </label>
          <label className="text-xs font-medium text-[var(--text-secondary)]">Status
            <select value={status} onChange={(event) => { setPage(0); setStatus(event.target.value); }} className="mt-1 block min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--text-primary)]">
              <option value="all">Any status</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting_for_customer">Waiting for customer</option><option value="resolved">Resolved</option>
            </select>
          </label>
          <label className="text-xs font-medium text-[var(--text-secondary)]">Type
            <select value={kind} onChange={(event) => { setPage(0); setKind(event.target.value); }} className="mt-1 block min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--text-primary)]">
              <option value="all">Any type</option><option value="ai">AI chat</option><option value="handoff">Human handoff</option><option value="mixed">AI + human</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Archive view
            <select value={archived} onChange={(event) => { setPage(0); setArchived(event.target.value); }} className="ml-2 min-h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--text-primary)]">
              <option value="active">Hide archived</option><option value="archived">Archived only</option><option value="all">All records</option>
            </select>
          </label>
          <button type="button" onClick={clearFilters} className="ml-auto rounded-md px-3 py-2 text-sm font-medium text-[var(--accent)]">Clear filters</button>
          <span className="text-xs text-[var(--text-secondary)]">{total} result{total === 1 ? "" : "s"}</span>
        </div>
      </section>

      {error && <div role="alert" className="mb-4 rounded-lg border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[var(--error-soft)] p-3 text-sm text-[var(--error)]">{error} {items.length === 0 && <button type="button" onClick={() => void load()} className="ml-2 underline">Retry</button>}</div>}
      <div className="grid gap-4 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
        <section aria-label="Conversation results" className={`${selected ? "hidden lg:block" : ""} min-w-0 space-y-2`}>
          {loading && items.length === 0 && <p className="surface rounded-xl p-5 text-sm text-[var(--text-secondary)]">Loading history…</p>}
          {!loading && items.length === 0 && !error && <p className="surface rounded-xl border-dashed p-8 text-center text-sm text-[var(--text-secondary)]">No persisted conversations match these filters.</p>}
          {items.map((item) => (
            <button key={`${item.kind}-${item.id}`} type="button" onClick={() => void openDetail(item)} aria-pressed={selected?.id === item.id}
              className={`surface w-full rounded-lg p-3 text-left transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] ${selected?.id === item.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : ""}`}>
              <div className="flex items-center justify-between gap-2"><strong className="truncate text-sm text-[var(--text-primary)]">{item.title}</strong><span className="shrink-0 text-xs text-[var(--text-secondary)]">{item.archived ? "Archived" : STATUS_LABELS[item.status] || item.status}</span></div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]"><span className="truncate">{item.customer} · {item.kind === "mixed" ? "AI + human" : item.kind === "handoff" ? "Human handoff" : "AI chat"}</span><time>{dateLabel(item.lastActivityAt)}</time></div>
              <p className="mt-1 line-clamp-1 text-sm text-[var(--text-secondary)]">{item.preview}</p>
            </button>
          ))}
          <div className="flex items-center justify-between py-2">
            <button type="button" disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50">Previous</button>
            <span className="text-xs text-[var(--text-secondary)]">Page {page + 1}</span>
            <button type="button" disabled={(page + 1) * 25 >= total || loading} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50">Next</button>
          </div>
        </section>

        <section ref={detailPanelRef} className={`${selected ? "" : "hidden lg:block"} surface min-h-96 min-w-0 scroll-mt-3 rounded-xl p-4 sm:p-5`} aria-label="Conversation detail">
          {!selected && <p className="text-sm text-[var(--text-secondary)]">Select a conversation to review its saved messages.</p>}
          {selected && <>
            <button type="button" onClick={() => setSelected(null)} className="mb-3 min-h-10 rounded-lg px-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] lg:hidden">← Back to history</button>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div><h2 className="font-semibold text-[var(--text-primary)]">{selected.title}</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">{selected.customer} · {selected.kind === "mixed" ? "AI + human handoff" : selected.kind === "handoff" ? "Human handoff" : "AI chat"}</p></div>
              <div className="flex gap-2">
                {selected.kind !== "ai" && selected.status === "resolved" && <button type="button" disabled={saving} onClick={() => void setHandoffArchived(!selected.archived)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50">{saving ? "Saving…" : selected.archived ? "Restore" : "Archive"}</button>}
                {selected.kind !== "ai" && <Link href={`/handoffs?view=${selected.archived ? "archived" : selected.status === "resolved" ? "resolved" : "active"}`} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--accent)]">Open in Support Inbox</Link>}
              </div>
            </div>
            {detailLoading && <p className="py-5 text-sm text-[var(--text-secondary)]">Loading messages…</p>}
            {!detailLoading && detail?.messages.length === 0 && <p className="py-5 text-sm text-[var(--text-secondary)]">No messages were persisted for this record.</p>}
            {!detailLoading && detail && <ol className="mt-4 max-h-[65vh] space-y-3 overflow-y-auto">
              {detail.messages.map((message) => <li key={message.id} className={`rounded-lg border border-[var(--border)] p-3 ${message.role === "human" ? "ml-6 bg-[var(--accent-soft)]" : "mr-6 bg-[var(--surface-muted)]"}`}>
                <div className="flex items-center justify-between gap-3"><strong className="text-xs font-semibold uppercase text-[var(--text-secondary)]">{message.role === "user" || message.role === "customer" ? "Visitor" : message.role === "human" ? "Human support" : "AI assistant"}</strong><time className="text-xs text-[var(--text-secondary)]">{dateLabel(message.created_at)}</time></div>
                {shouldRenderAsMarkdown(message.role) ? (
                  <div className="mt-2 text-sm text-[var(--text-primary)]">
                    <MessageContent content={message.content} />
                  </div>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-primary)] break-words [overflow-wrap:anywhere]">
                    {message.content}
                  </p>
                )}
                {message.sources && message.sources.length > 0 && <div className="mt-3 border-t border-[var(--border)] pt-2"><p className="text-xs font-medium text-[var(--text-secondary)]">Sources</p><ul className="mt-1 space-y-1">{message.sources.map((source, index) => <li key={`${source.label}-${index}`} className="text-xs text-[var(--text-secondary)]">{source.label}{Number.isInteger(source.chunk_index) ? ` · section ${source.chunk_index! + 1}` : ""}</li>)}</ul></div>}
              </li>)}
            </ol>}
          </>}
        </section>
      </div>
    </PageFrame>
  );
}
