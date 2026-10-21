type ErrorRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ErrorRecord {
  return Boolean(value && typeof value === "object");
}

export function isChatRequestAborted(error: unknown, requestSignal?: AbortSignal): boolean {
  // Only the incoming request signal tells us the visitor disconnected. The
  // Gemini SDK also uses AbortError when its own configured timeout expires.
  return Boolean(requestSignal?.aborted);
}

function isSdkTimeoutAbort(error: unknown): boolean {
  if (!isRecord(error)) return false;
  return error.name === "AbortError" || error.code === 20;
}

export type ChatFailure = {
  category: "deadline_exceeded" | "request_failed";
  status: 504 | 500;
  message: string;
};

/** Classifies provider/transport failures without returning their raw details. */
export function classifyChatFailure(error: unknown): ChatFailure {
  const outer = isRecord(error) ? error : {};
  const nested = isRecord(outer.error) ? outer.error : {};
  const message = [outer.message, nested.message]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  const status = outer.status ?? nested.status ?? outer.code ?? nested.code;
  const isDeadline = isSdkTimeoutAbort(error) || status === 504 || status === "504" ||
    outer.code === "DEADLINE_EXCEEDED" || nested.code === "DEADLINE_EXCEEDED" ||
    outer.status === "DEADLINE_EXCEEDED" || nested.status === "DEADLINE_EXCEEDED" ||
    /DEADLINE_EXCEEDED|deadline expired/i.test(message);

  return isDeadline
    ? { category: "deadline_exceeded", status: 504, message: "The assistant service timed out. Please retry shortly." }
    : { category: "request_failed", status: 500, message: "The assistant couldn’t complete this request. Please try again." };
}

export function safeChatFailureDiagnostics(error: unknown) {
  const outer = isRecord(error) ? error : {};
  const nested = isRecord(outer.error) ? outer.error : {};
  const failure = classifyChatFailure(error);
  const upstreamStatus = outer.status ?? nested.status ??
    (outer.code === 504 || nested.code === 504 ? 504 : undefined);
  return {
    category: failure.category,
    errorName: error instanceof Error ? error.name : "UpstreamError",
    ...(isSdkTimeoutAbort(error) ? { timeoutSource: "gemini_sdk" } : {}),
    ...(typeof upstreamStatus === "number" || typeof upstreamStatus === "string"
      ? { upstreamStatus }
      : {}),
  };
}

export function getSafeChatFailureMessage(value: unknown): string {
  if (isRecord(value) && value.code === "PERSISTENCE_FAILED") {
    return "Your response could not be saved. Please retry.";
  }
  if (classifyChatFailure(value).category === "deadline_exceeded") {
    return "The assistant service timed out. Please retry shortly.";
  }
  const message = value instanceof Error ? value.message : "";
  if (message === "The assistant service timed out. Please retry shortly." ||
    message === "The assistant couldn’t complete this request. Please try again." ||
    message === "Your response could not be saved. Please retry.") return message;
  return "The assistant couldn’t complete this request. Please try again.";
}

export function getSafeChatFailureCode(value: unknown): "DEADLINE_EXCEEDED" | "PERSISTENCE_FAILED" | "CHAT_FAILED" {
  if (isRecord(value)) {
    if (value.code === "PERSISTENCE_FAILED") return "PERSISTENCE_FAILED";
    if (value.code === "DEADLINE_EXCEEDED") return "DEADLINE_EXCEEDED";
  }
  if (value instanceof Error && value.message === "The assistant service timed out. Please retry shortly.") {
    return "DEADLINE_EXCEEDED";
  }
  if (value instanceof Error && value.message === "Your response could not be saved. Please retry.") {
    return "PERSISTENCE_FAILED";
  }
  return classifyChatFailure(value).category === "deadline_exceeded" ? "DEADLINE_EXCEEDED" : "CHAT_FAILED";
}
