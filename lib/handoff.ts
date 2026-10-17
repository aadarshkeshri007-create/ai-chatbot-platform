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

export function createHandoffAccessToken(): {
  token: string;
  hash: string;
} {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHandoffTokenHash(token) };
}

export function createHandoffTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
