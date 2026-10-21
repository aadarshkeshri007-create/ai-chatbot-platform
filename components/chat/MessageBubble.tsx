import type { Message } from "@/types/message";
import MessageContent from "./MessageContent";
import { useRef, useState } from "react";
import type { FeedbackType } from "@/lib/testing-playground";
import { submitFeedbackOnce } from "@/lib/answer-feedback";
import { getMessageCitationChips } from "@/lib/message-citations";

type MessageBubbleProps = {
  message: Message;
  question?: Message;
  onFeedback?: (assistant: Message, question: Message, type: FeedbackType, category?: string) => Promise<void>;
};

const feedbackCategories = [
  ["missing_knowledge", "Missing knowledge"], ["incorrect_answer", "Incorrect answer"],
  ["irrelevant_sources", "Irrelevant sources"], ["formatting_clarity", "Formatting or clarity"], ["other", "Other"],
];

export default function MessageBubble({ message, question, onFeedback }: MessageBubbleProps) {
  const [category, setCategory] = useState("missing_knowledge");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);
  const isUser = message.role === "user";
  const citations = getMessageCitationChips(message);

  const sendFeedback = async (type: FeedbackType) => {
    if (!question || !onFeedback || submittingRef.current || saved) return;
    setSubmitting(true);
    setError("");
    const result = await submitFeedbackOnce(submittingRef, () =>
      onFeedback(message, question, type, type === "helpful" ? undefined : category),
    );
    if (result.status === "saved") {
      setSaved(true);
    } else if (result.status === "failed") {
      setError(result.error instanceof Error ? result.error.message : "Unable to save feedback.");
    }
    setSubmitting(false);
  };

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Assistant avatar */}
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] mt-0.5 shadow-sm">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.5V20a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2.5c2.9-1.2 5-4.1 5-7.5a8 8 0 0 0-8-8z" />
            <path d="M10 22h4" />
          </svg>
        </div>
      )}

      <div
        className={
          isUser
            ? "max-w-[88%] sm:max-w-lg min-w-0 break-words [overflow-wrap:anywhere] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-teal-600 px-3.5 py-2.5 sm:px-4 text-[14px] leading-relaxed text-white shadow-sm"
            : "max-w-[88%] sm:max-w-2xl min-w-0 break-words [overflow-wrap:anywhere] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 sm:px-4 text-[14px] leading-relaxed text-[var(--text-primary)] shadow-sm"
        }
      >
        <MessageContent content={message.content} isUser={isUser} />
        {!isUser && message.id !== "new-chat" && message.content && (message.retrievalState || citations.length > 0) && (
          <div className="mt-2 border-t border-[var(--border)] pt-2">
            {citations.length > 0 ? (
              <ul aria-label="Answer sources" className="flex flex-wrap gap-1.5">
                {citations.map((citation) => (
                  <li key={citation.key} className="max-w-full rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-xs leading-4 text-[var(--text-secondary)]">
                    <span className="break-words">{citation.label}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">No supporting source was cited for this answer.</p>
            )}
            {question && onFeedback && <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {!saved ? <>
                <button type="button" disabled={submitting} onClick={() => void sendFeedback("helpful")} className="min-h-8 rounded-md border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-50">Helpful</button>
                <button type="button" disabled={submitting} onClick={() => void sendFeedback("not_helpful")} className="min-h-8 rounded-md border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-50">Not helpful</button>
                <button type="button" disabled={submitting} onClick={() => void sendFeedback("report_issue")} className="min-h-8 rounded-md border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-50">Report issue</button>
                <select aria-label="Feedback category" value={category} disabled={submitting} onChange={(event) => setCategory(event.target.value)} className="min-h-8 max-w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs">
                  {feedbackCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </> : <span role="status" className="text-xs text-[var(--text-secondary)]">Feedback recorded</span>}
              {submitting && <span role="status" className="text-xs text-[var(--text-secondary)]">Saving feedback…</span>}
            </div>}
            {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--text-primary)] mt-0.5 shadow-sm">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      )}
    </div>
  );
}
