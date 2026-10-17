import { randomUUID } from "node:crypto";

export type PublicChatStage =
  | "rate-limit"
  | "assistant-lookup"
  | "retrieval"
  | "answer-generation";

const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_]{0,31}$/;

export function createPublicChatCorrelationId(): string {
  return randomUUID();
}

export function getSafeErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    SAFE_ERROR_CODE.test(error.code)
  ) {
    return error.code;
  }

  return "UNKNOWN_ERROR";
}

export function logPublicChatError(
  stage: PublicChatStage,
  correlationId: string,
  error?: unknown,
): void {
  console.error("[public-chat]", {
    stage,
    category: "backend-failure",
    code: getSafeErrorCode(error),
    correlationId,
  });
}

