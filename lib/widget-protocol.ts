export const WIDGET_MAX_MESSAGE_LENGTH = 8000;
export const WIDGET_REQUEST_TIMEOUT_MS = 30_000;
export const WIDGET_MAX_RETRY_AFTER_SECONDS = 300;

export type WidgetSender = "user" | "assistant" | "human";

export function classifyWidgetSender(role: unknown): WidgetSender | null {
  return role === "user" || role === "assistant" || role === "human" ? role : null;
}

export function resolveWidgetParentOrigin(search: string, referrer: string): string {
  const configuredOrigin = new URLSearchParams(search).get("parent_origin");
  const candidate = configuredOrigin || referrer;
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}

export function parseRetryAfterSeconds(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value.trim())) return null;
  const seconds = Number(value.trim());
  if (!Number.isSafeInteger(seconds)) return null;
  return Math.min(seconds, WIDGET_MAX_RETRY_AFTER_SECONDS);
}

export function formatRateLimitMessage(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null) return "Too many requests. Please wait before trying again.";
  const unit = retryAfterSeconds === 1 ? "second" : "seconds";
  return `Too many requests. Please wait ${retryAfterSeconds} ${unit} before trying again.`;
}

export type WidgetChatRequest = {
  type: "supportai:chat-request";
  requestId: string;
  assistantId?: unknown;
  message: string;
};

export function isTrustedWidgetMessage(
  source: unknown,
  expectedSource: unknown,
  origin: string,
  expectedOrigin: string,
): boolean {
  return source === expectedSource && origin === expectedOrigin;
}

export function isWidgetChatRequest(value: unknown): value is WidgetChatRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "supportai:chat-request" &&
    typeof candidate.requestId === "string" &&
    candidate.requestId.length > 0 &&
    candidate.requestId.length <= 128 &&
    typeof candidate.message === "string" &&
    candidate.message.trim().length > 0 &&
    candidate.message.length <= WIDGET_MAX_MESSAGE_LENGTH
  );
}

export type WidgetChatResponse =
  | {
      type: "supportai:chat-response";
      requestId: string;
      ok: true;
      payload: Record<string, unknown>;
    }
  | {
      type: "supportai:chat-response";
      requestId: string;
      ok: false;
      error: string;
      status?: number;
      retryAfterSeconds?: number | null;
    };

export function isWidgetChatResponse(value: unknown): value is WidgetChatResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.type !== "supportai:chat-response" ||
    typeof candidate.requestId !== "string" ||
    candidate.requestId.length === 0 ||
    typeof candidate.ok !== "boolean"
  ) return false;
  if (candidate.ok) {
    return typeof candidate.payload === "object" &&
      candidate.payload !== null &&
      !Array.isArray(candidate.payload);
  }
  return typeof candidate.error === "string" &&
    candidate.error.length <= 1000 &&
    (candidate.status === undefined ||
      (typeof candidate.status === "number" &&
        Number.isInteger(candidate.status) &&
        candidate.status >= 400 &&
        candidate.status <= 599)) &&
    (candidate.retryAfterSeconds === undefined ||
      candidate.retryAfterSeconds === null ||
      (typeof candidate.retryAfterSeconds === "number" &&
        Number.isInteger(candidate.retryAfterSeconds) &&
        candidate.retryAfterSeconds >= 0 &&
        candidate.retryAfterSeconds <= WIDGET_MAX_RETRY_AFTER_SECONDS));
}

export type WidgetHandoffRequest = {
  type: "supportai:handoff-request";
  requestId: string;
  assistantId?: unknown;
  customerName?: string;
  customerEmail?: string;
  reason: string;
  transcript: Array<{ role: "user" | "assistant"; content: string }>;
};

export function isWidgetHandoffRequest(value: unknown): value is WidgetHandoffRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.type === "supportai:handoff-request" &&
    typeof candidate.requestId === "string" &&
    candidate.requestId.length > 0 &&
    candidate.requestId.length <= 128 &&
    typeof candidate.reason === "string" &&
    candidate.reason.trim().length > 0 &&
    candidate.reason.length <= 2000 &&
    Array.isArray(candidate.transcript) &&
    candidate.transcript.length <= 50;
}

export type WidgetHandoffPollRequest = {
  type: "supportai:handoff-poll";
  requestId: string;
  handoffId: string;
  accessToken: string;
};

export function isWidgetHandoffPollRequest(value: unknown): value is WidgetHandoffPollRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.type === "supportai:handoff-poll" &&
    typeof candidate.requestId === "string" &&
    candidate.requestId.length > 0 &&
    candidate.requestId.length <= 128 &&
    typeof candidate.handoffId === "string" &&
    candidate.handoffId.length <= 100 &&
    typeof candidate.accessToken === "string" &&
    candidate.accessToken.length <= 200;
}
