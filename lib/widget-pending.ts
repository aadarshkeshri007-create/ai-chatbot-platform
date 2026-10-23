/**
 * Tracks a visitor question that was sent but not yet confirmed as answered, so
 * a refresh mid-request can offer to resend it. The saved request id is reused
 * on resend, and the server persists a turn idempotently per request id, so a
 * resend can never create a duplicate turn.
 *
 * Only the visitor's own just-typed question is stored (never contact form
 * fields), it is scoped by assistant id, expires quickly, and is cleared on
 * success or when the visitor starts a new conversation.
 */
export const WIDGET_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PENDING_MESSAGE_LENGTH = 8000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PendingWidgetQuestion = { requestId: string; message: string; savedAt: number };

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function pendingQuestionKey(assistantId: string): string {
  return `supportai:widget-pending:${assistantId}`;
}

export function savePendingQuestion(
  assistantId: string,
  question: { requestId: string; message: string },
  storage: StorageLike,
  now: number = Date.now(),
): void {
  try {
    storage.setItem(pendingQuestionKey(assistantId), JSON.stringify({ ...question, savedAt: now }));
  } catch { /* Storage unavailable: resend recovery is best-effort. */ }
}

export function readPendingQuestion(
  assistantId: string,
  storage: StorageLike,
  now: number = Date.now(),
): PendingWidgetQuestion | null {
  try {
    const raw = storage.getItem(pendingQuestionKey(assistantId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingWidgetQuestion>;
    if (
      typeof value.requestId !== "string" || !uuidPattern.test(value.requestId) ||
      typeof value.message !== "string" || !value.message.trim() ||
      value.message.length > MAX_PENDING_MESSAGE_LENGTH ||
      typeof value.savedAt !== "number" || !Number.isFinite(value.savedAt) ||
      now - value.savedAt > WIDGET_PENDING_TTL_MS || value.savedAt > now + 60_000
    ) {
      storage.removeItem(pendingQuestionKey(assistantId));
      return null;
    }
    return { requestId: value.requestId, message: value.message, savedAt: value.savedAt };
  } catch {
    try { storage.removeItem(pendingQuestionKey(assistantId)); } catch { /* ignore */ }
    return null;
  }
}

export function clearPendingQuestion(assistantId: string, storage: StorageLike): void {
  try { storage.removeItem(pendingQuestionKey(assistantId)); } catch { /* ignore */ }
}

/**
 * Decide what to do with a stored pending question once history has loaded.
 * - "answered": the server already has the assistant turn -> just clear it.
 * - "resend": no saved turn -> restore the text for an idempotent resend.
 */
export function classifyPendingQuestion(
  pending: PendingWidgetQuestion,
  restored: Array<{ role: string; request_id?: string }>,
): "answered" | "resend" {
  return restored.some((item) => item.role === "assistant" && item.request_id === pending.requestId)
    ? "answered"
    : "resend";
}
