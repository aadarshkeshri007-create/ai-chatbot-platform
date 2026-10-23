type DocumentLoadErrorShape = {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
};

function safeText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\b(password|token|secret|authorization|apikey)\b\s*[:=]\s*[^ ,;]+/gi, "$1=[redacted]")
    .trim()
    .slice(0, maxLength);
  return cleaned || undefined;
}

export function getDocumentLoadDiagnostics(error: unknown) {
  const value = (typeof error === "object" && error !== null ? error : {}) as DocumentLoadErrorShape;
  const status = typeof value.status === "number" ? value.status
    : typeof value.statusCode === "number" ? value.statusCode : undefined;
  return {
    name: safeText(value.name, 80),
    message: safeText(value.message, 300),
    code: safeText(value.code, 40),
    status,
  };
}

export function getDocumentLoadUserMessage(error: unknown): string {
  const { code } = getDocumentLoadDiagnostics(error);
  if (["42703", "42P01", "PGRST204", "PGRST205"].includes(code ?? "")) {
    return "Documents could not be loaded because the database schema is unavailable or out of date. Check that the required document migrations have been applied, then retry.";
  }
  if (["401", "403", "42501"].includes(code ?? "")) {
    return "You are not authorized to load these documents. Sign in again, then retry.";
  }
  return "Unable to load your documents right now. Check your connection and access, then retry.";
}
