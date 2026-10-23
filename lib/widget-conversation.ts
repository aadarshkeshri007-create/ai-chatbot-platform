import { createHash, randomBytes } from "node:crypto";

export const WIDGET_SESSION_TOKEN_BYTES = 32;
export const WIDGET_SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,100}$/;

export function createWidgetSessionToken(): string {
  return randomBytes(WIDGET_SESSION_TOKEN_BYTES).toString("base64url");
}

export function hashWidgetSessionToken(token: string): string {
  if (!WIDGET_SESSION_TOKEN_PATTERN.test(token)) throw new Error("Invalid visitor session token");
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function safeWidgetSources(value: unknown): Array<{
  label: string;
  document_id?: string;
  chunk_id?: string;
  chunk_index?: number;
}> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;
    if (typeof source.label !== "string" || !source.label.trim()) return [];
    const documentId = typeof source.document_id === "string" && source.document_id.length > 0 && source.document_id.length <= 200
      ? source.document_id
      : undefined;
    const chunkId = typeof source.chunk_id === "string" && source.chunk_id.length > 0 && source.chunk_id.length <= 200
      ? source.chunk_id
      : undefined;
    return [{
      label: source.label.trim().slice(0, 200),
      ...(documentId ? { document_id: documentId } : {}),
      ...(chunkId ? { chunk_id: chunkId } : {}),
      ...(Number.isInteger(source.chunk_index) && (source.chunk_index as number) >= 0 && (source.chunk_index as number) <= 2_147_483_647
        ? { chunk_index: source.chunk_index as number }
        : {}),
    }];
  });
}

export type PublicChatTurnInput = {
  assistantId: string;
  sessionHash: string;
  requestId: string;
  visitorMessage: string;
  assistantMessage: string;
  sources: unknown;
  title: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidPublicChatTurnInput(value: PublicChatTurnInput): boolean {
  if (!uuidPattern.test(value.assistantId) || !uuidPattern.test(value.requestId) ||
      !/^[a-f0-9]{64}$/.test(value.sessionHash) ||
      value.visitorMessage.trim().length < 1 || value.visitorMessage.trim().length > 8000 ||
      value.assistantMessage.trim().length < 1 || value.assistantMessage.trim().length > 64000 ||
      value.title.length > 120 || !Array.isArray(value.sources) || value.sources.length > 10) return false;
  return value.sources.every((source) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) return false;
    const item = source as Record<string, unknown>;
    return typeof item.label === "string" && item.label.trim().length >= 1 && item.label.trim().length <= 200 &&
      (item.document_id === undefined || (typeof item.document_id === "string" && item.document_id.length >= 1 && item.document_id.length <= 200)) &&
      (item.chunk_id === undefined || (typeof item.chunk_id === "string" && item.chunk_id.length >= 1 && item.chunk_id.length <= 200)) &&
      (item.chunk_index === undefined || (Number.isInteger(item.chunk_index) && (item.chunk_index as number) >= 0 && (item.chunk_index as number) <= 2_147_483_647));
  });
}

