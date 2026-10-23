import { createHash, randomBytes } from "node:crypto";

export const HANDOFF_MAX_REASON_LENGTH = 2000;
export const HANDOFF_MAX_TRANSCRIPT_MESSAGES = 50;
export const HANDOFF_MAX_MESSAGE_LENGTH = 8000;

export type HandoffTranscriptMessage = {
  role: "user" | "assistant";
  content: string;
};

export function normalizeOptionalText(
  value: unknown,
  maxLength: number,
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

export function normalizeEmail(value: unknown): string | null {
  const email = normalizeOptionalText(value, 254)?.toLowerCase() ?? null;
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function parseTranscript(value: unknown): HandoffTranscriptMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-HANDOFF_MAX_TRANSCRIPT_MESSAGES)
    .filter((item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null && !Array.isArray(item),
    )
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({
      role: item.role as "user" | "assistant",
      content: typeof item.content === "string"
        ? item.content.trim().slice(0, HANDOFF_MAX_MESSAGE_LENGTH)
        : "",
    }))
    .filter((item) => item.content.length > 0);
}

export function createHandoffAccessToken(idempotencySeed?: string): {
  token: string;
  hash: string;
} {
  const token =
    typeof idempotencySeed === "string" && idempotencySeed.trim().length > 0
      ? createHash("sha256").update(`supportai-handoff-token-v1:${idempotencySeed}`).digest("base64url")
      : randomBytes(32).toString("base64url");
  return { token, hash: createHandoffTokenHash(token) };
}

export function createHandoffTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function resolveHandoffLatestMessage(
  latestMessage: unknown,
  transcript: ReadonlyArray<HandoffTranscriptMessage>,
  reason: string,
): string | null {
  const explicit = normalizeOptionalText(latestMessage, HANDOFF_MAX_MESSAGE_LENGTH);
  if (explicit) return explicit;

  for (let i = transcript.length - 1; i >= 0; i--) {
    if (transcript[i]?.role === "user") {
      const fromTranscript = normalizeOptionalText(
        transcript[i].content,
        HANDOFF_MAX_MESSAGE_LENGTH,
      );
      if (fromTranscript) return fromTranscript;
    }
  }

  return normalizeOptionalText(reason, HANDOFF_MAX_REASON_LENGTH);
}

const MAX_DISMISSED_TURNS = 50;

export function dismissedEscalationsStorageKey(assistantId: string): string {
  return `supportai:dismissed-escalations:${assistantId}`;
}

export function readDismissedEscalationTurns(
  assistantId: string,
  storage?: Pick<Storage, "getItem"> | null,
): string[] {
  if (!assistantId || !storage) return [];
  try {
    const raw = storage.getItem(dismissedEscalationsStorageKey(assistantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0 && item.length <= 128)
      .slice(-MAX_DISMISSED_TURNS);
  } catch {
    return [];
  }
}

export function isEscalationTurnDismissed(
  assistantId: string,
  requestId: string | null | undefined,
  storage?: Pick<Storage, "getItem"> | null,
): boolean {
  if (!assistantId || !requestId) return false;
  return readDismissedEscalationTurns(assistantId, storage).includes(requestId);
}

export function dismissEscalationTurn(
  assistantId: string,
  requestId: string,
  storage?: Pick<Storage, "getItem" | "setItem"> | null,
): void {
  if (!assistantId || !requestId || !storage) return;
  try {
    const current = readDismissedEscalationTurns(assistantId, storage);
    if (current.includes(requestId)) return;
    const next = [...current, requestId].slice(-MAX_DISMISSED_TURNS);
    storage.setItem(dismissedEscalationsStorageKey(assistantId), JSON.stringify(next));
  } catch {
    // Ignore storage write errors in restricted browsing contexts.
  }
}

export function clearDismissedEscalations(
  assistantId: string,
  storage?: Pick<Storage, "removeItem"> | null,
): void {
  if (!assistantId || !storage) return;
  try {
    storage.removeItem(dismissedEscalationsStorageKey(assistantId));
  } catch {
    // Ignore storage removal errors in restricted browsing contexts.
  }
}
