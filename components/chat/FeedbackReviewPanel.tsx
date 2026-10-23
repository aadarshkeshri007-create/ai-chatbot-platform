"use client";

import { useCallback, useState } from "react";

type Draft = { id: string; draft_question: string; draft_answer: string; reason: string; source_refs: Array<{ label: string; chunk_index?: number }>; status: string; processing_error?: string | null; document_id?: string | null };
type Item = { id: string; feedback_type: string; category: string | null; comment: string | null; original_question: string; original_answer: string; source_refs: Array<{ label: string; chunk_index?: number }>; draft: Draft | null };

function DraftReview({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const [question, setQuestion] = useState(item.draft?.draft_question ?? item.original_question);
  const [answer, setAnswer] = useState(item.draft?.draft_answer ?? item.original_answer);
  const [reason, setReason] = useState(item.draft?.reason ?? [item.category, item.comment].filter(Boolean).join(": "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const draft = item.draft;

  const save = async (action: "save" | "approve") => {
    if (!draft || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/chat/faq-drafts/${draft.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, question, answer, reason }),
      });
      const result = await response.json().catch(() => null) as { error?: string; documentId?: string; status?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Unable to update this FAQ draft.");
      if (action === "approve" && result?.documentId) {
        setNotice("Approved. Processing the FAQ through the knowledge pipeline…");
        const processResponse = await fetch("/api/documents/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: result.documentId }) });
        const processResult = await processResponse.json().catch(() => null) as { error?: string } | null;
        if (!processResponse.ok) throw new Error(processResult?.error || "Approved, but knowledge processing failed. Retry from Knowledge Base.");
        setNotice("FAQ processed and added to searchable knowledge.");
      } else {
        setNotice("Draft saved for review. It is not active knowledge.");
      }
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update this FAQ draft.");
      onChanged();
    } finally { setBusy(false); }
  };

  return <div className="mt-3 rounded-lg border border-[var(--border)] p-3">
    <p className="text-xs font-semibold text-[var(--text-secondary)]">Original question</p>
    <p className="mt-1 whitespace-pre-wrap text-sm">{item.original_question}</p>
    <p className="mt-3 text-xs font-semibold text-[var(--text-secondary)]">Reported answer</p>
    <p className="mt-1 whitespace-pre-wrap text-sm">{item.original_answer}</p>
    <p className="mt-2 text-xs text-[var(--text-secondary)]">Issue: {item.category || "Not categorized"}{item.comment ? ` · ${item.comment}` : ""}</p>
    {item.source_refs?.length > 0 && <p className="mt-1 text-xs text-[var(--text-secondary)]">Sources: {item.source_refs.map((source) => `${source.label}${Number.isInteger(source.chunk_index) ? ` (section ${source.chunk_index! + 1})` : ""}`).join(", ")}</p>}
    {!draft && item.feedback_type !== "helpful" ? <button type="button" onClick={async () => {
      setBusy(true); setError("");
      try { const response = await fetch(`/api/chat/feedback/${item.id}/draft`, { method: "POST" }); const result = await response.json().catch(() => null) as { error?: string } | null; if (!response.ok) throw new Error(result?.error || "Unable to create FAQ draft."); onChanged(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create FAQ draft."); }
      finally { setBusy(false); }
    }} disabled={busy} className="mt-3 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium disabled:opacity-50">{busy ? "Creating…" : "Create FAQ draft"}</button> : draft ? <>
      <p className="mt-3 text-xs font-semibold text-[var(--text-secondary)]">Editable FAQ draft · requires your review</p>
      <label className="mt-2 block text-xs">Question<input value={question} onChange={(event) => setQuestion(event.target.value)} disabled={!(["pending_review", "failed"].includes(draft.status))} maxLength={8000} className="mt-1 min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" /></label>
      <label className="mt-2 block text-xs">Answer<textarea value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={!(["pending_review", "failed"].includes(draft.status))} maxLength={8000} rows={4} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" /></label>
      <label className="mt-2 block text-xs">Review note<textarea value={reason} onChange={(event) => setReason(event.target.value)} disabled={!(["pending_review", "failed"].includes(draft.status))} maxLength={2000} rows={2} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" /></label>
      <p className="mt-2 text-xs text-[var(--text-secondary)]">Status: <strong>{draft.status.replaceAll("_", " ")}</strong>{draft.processing_error ? ` · ${draft.processing_error}` : ""}</p>
      {item.feedback_type !== "helpful" && (draft.status === "pending_review" || draft.status === "failed" || draft.status === "approved") ? <div className="mt-3 flex flex-wrap gap-2">
        {(draft.status === "pending_review" || draft.status === "failed") && <button type="button" onClick={() => void save("save")} disabled={busy} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium disabled:opacity-50">Save draft</button>}
        <button type="button" onClick={() => void save("approve")} disabled={busy || answer.trim().length < 10} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Processing…" : draft.status === "approved" ? "Retry approval or processing" : "Approve and process"}</button>
      </div> : null}
    </> : <p className="mt-3 text-xs text-[var(--text-secondary)]">FAQ drafts are available for feedback that reports an issue.</p>}
    {notice && <p role="status" className="mt-2 text-xs text-[var(--success)] dark:text-[var(--success)]">{notice}</p>}
    {error && <p role="alert" className="mt-2 text-xs text-[var(--error)]">{error}</p>}
  </div>;
}

export default function FeedbackReviewPanel() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/chat/feedback");
      const result = await response.json().catch(() => null) as { items?: Item[]; error?: string } | null;
      if (!response.ok || !result?.items) throw new Error(result?.error || "Unable to load feedback.");
      setItems(result.items);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load feedback."); }
    finally { setLoading(false); }
  }, []);
  return <section className="relative shrink-0">
    <button type="button" aria-label={open ? "Hide feedback and FAQ review" : "Open feedback and FAQ review"} aria-expanded={open} onClick={() => { setOpen((value) => !value); if (!open) void refresh(); }} className="flex min-h-8 items-center gap-2 rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">
      <span className="hidden sm:inline">Feedback & FAQ review</span><span className="sm:hidden">FAQ review</span><span aria-hidden="true">{open ? "−" : "Review"}</span>
    </button>
    {open && <div className="absolute right-0 top-full z-20 mt-2 max-h-[70dvh] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--text-primary)] shadow-xl sm:p-4">
      {loading && <p role="status" className="text-xs text-[var(--text-secondary)]">Loading feedback…</p>}
      {error && <p role="alert" className="text-xs text-[var(--error)]">{error} <button type="button" onClick={() => void refresh()} className="underline">Retry</button></p>}
      {!loading && !error && items.length === 0 && <p className="text-xs text-[var(--text-secondary)]">Feedback you submit on test answers will appear here. No evaluations or success scores are inferred.</p>}
      <div className="space-y-3">{items.map((item) => <article key={item.id} className="rounded-lg border border-[var(--border)] p-3">
        <p className="text-xs font-semibold uppercase text-[var(--text-secondary)]">{item.feedback_type.replaceAll("_", " ")}{item.category ? ` · ${item.category.replaceAll("_", " ")}` : ""}</p>
        <DraftReview item={item} onChanged={() => void refresh()} />
      </article>)}</div>
    </div>}
  </section>;
}
