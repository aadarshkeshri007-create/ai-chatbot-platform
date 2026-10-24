export type LeadInput = {
  name: string;
  email: string;
  question: string;
};

export type LeadWebhookPayload = {
  name: string;
  email: string;
  question: string;
  timestamp: string;
};

export type LeadDeliveryResult =
  | { ok: true }
  | { ok: false; reason: "missing_configuration" | "invalid_configuration" | "timeout" | "network_failure" | "http_rejected"; status?: number };

export type LeadWebhookFailure = {
  code: string;
  message: string;
  status: number;
  upstreamStatus?: number;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseLeadInput(value: unknown): LeadInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.name !== "string" || typeof input.email !== "string" || typeof input.question !== "string") {
    return null;
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const question = input.question.trim();
  if (!name || name.length > 120 || !EMAIL_PATTERN.test(email) || email.length > 254 || !question || question.length > 5000) {
    return null;
  }
  return { name, email, question };
}

export function createLeadWebhookPayload(lead: LeadInput, now = new Date()): LeadWebhookPayload {
  return {
    name: lead.name,
    email: lead.email.toLowerCase(),
    question: lead.question,
    timestamp: now.toISOString(),
  };
}

export const WEBHOOK_SECRET_HEADER = "X-SupportAI-Webhook-Secret";

export async function deliverLeadToWebhook(
  webhookUrl: string | undefined,
  payload: LeadWebhookPayload,
  webhookSecret?: string | undefined,
  fetcher?: typeof fetch,
): Promise<LeadDeliveryResult>;
export async function deliverLeadToWebhook(
  webhookUrl: string | undefined,
  payload: LeadWebhookPayload,
  fetcher?: typeof fetch,
): Promise<LeadDeliveryResult>;
export async function deliverLeadToWebhook(
  webhookUrl: string | undefined,
  payload: LeadWebhookPayload,
  secretOrFetcher?: string | typeof fetch,
  optionalFetcher?: typeof fetch,
): Promise<LeadDeliveryResult> {
  const secret = typeof secretOrFetcher === "string"
    ? secretOrFetcher
    : process.env.N8N_WEBHOOK_SECRET;
  const fetcher = typeof secretOrFetcher === "function"
    ? secretOrFetcher
    : (optionalFetcher ?? fetch);

  if (!webhookUrl?.trim() || !secret?.trim()) {
    return { ok: false, reason: "missing_configuration" };
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webhookUrl.trim());
    const isLocalDev = process.env.NODE_ENV !== "production" && parsedUrl.protocol === "http:" && (parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1");
    if (parsedUrl.protocol !== "https:" && !isLocalDev) return { ok: false, reason: "invalid_configuration" };
  } catch {
    return { ok: false, reason: "invalid_configuration" };
  }

  try {
    const response = await fetcher(parsedUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [WEBHOOK_SECRET_HEADER]: secret.trim(),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok
      ? { ok: true }
      : { ok: false, reason: "http_rejected", status: response.status };
  } catch (error) {
    const name = typeof error === "object" && error !== null && "name" in error && typeof error.name === "string"
      ? error.name
      : "";
    return name === "TimeoutError" || name === "AbortError"
      ? { ok: false, reason: "timeout" }
      : { ok: false, reason: "network_failure" };
  }
}

export function describeLeadWebhookFailure(result: Exclude<LeadDeliveryResult, { ok: true }>): LeadWebhookFailure {
  const upstreamStatus = result.reason === "http_rejected" ? result.status : undefined;
  const code = result.reason === "missing_configuration"
    ? "N8N_WEBHOOK_NOT_CONFIGURED"
    : result.reason === "invalid_configuration"
      ? "N8N_WEBHOOK_CONFIGURATION_INVALID"
      : result.reason === "timeout"
        ? "N8N_REQUEST_TIMEOUT"
        : result.reason === "network_failure"
          ? "N8N_NETWORK_FAILURE"
          : upstreamStatus === 404
            ? "N8N_WEBHOOK_NOT_FOUND"
            : upstreamStatus === 401 || upstreamStatus === 403
              ? "N8N_WEBHOOK_AUTH_REJECTED"
              : upstreamStatus !== undefined && upstreamStatus >= 500
                ? "N8N_SERVER_ERROR"
                : "N8N_HTTP_REJECTED";
  const message = code === "N8N_WEBHOOK_NOT_CONFIGURED"
    ? "Lead delivery is not configured. Please contact the site owner."
    : code === "N8N_WEBHOOK_CONFIGURATION_INVALID"
      ? "Lead delivery is misconfigured. Please contact the site owner."
      : code === "N8N_REQUEST_TIMEOUT" || code === "N8N_NETWORK_FAILURE"
        ? "The lead service could not be reached. Please try again later."
        : code === "N8N_WEBHOOK_NOT_FOUND"
          ? "The lead service endpoint was not found. The site owner should activate the n8n workflow and check its Production URL."
          : code === "N8N_WEBHOOK_AUTH_REJECTED"
            ? "The lead service rejected its configured authentication. Please contact the site owner."
            : "The lead service did not accept this submission. Please try again later.";
  return {
    code,
    message,
    status: result.reason === "missing_configuration" || result.reason === "invalid_configuration"
      ? 503
      : result.reason === "timeout" ? 504 : 502,
    ...(upstreamStatus ? { upstreamStatus } : {}),
  };
}
