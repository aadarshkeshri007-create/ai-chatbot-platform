import { createLeadWebhookPayload, deliverLeadToWebhook, describeLeadWebhookFailure, parseLeadInput } from "@/lib/lead-webhook";
import { publicChatJson, publicChatOptions, hasDisallowedPublicChatOrigin, isAllowedAssistantOrigin } from "@/lib/public-chat-cors";
import { checkPublicChatRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const assistantIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REQUEST_BYTES = 8 * 1024;

export function OPTIONS(request: Request) {
  if (hasDisallowedPublicChatOrigin(request)) {
    return publicChatJson(request, { success: false, message: "This website is not allowed to submit leads." }, { status: 403 });
  }
  return publicChatOptions(request);
}

export async function POST(request: Request) {
  if (hasDisallowedPublicChatOrigin(request)) {
    return publicChatJson(request, { success: false, message: "This website is not allowed to submit leads." }, { status: 403 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) {
    return publicChatJson(request, { success: false, message: "Please check your details and try again." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return publicChatJson(request, { success: false, message: "Please check your details and try again." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return publicChatJson(request, { success: false, message: "Please check your details and try again." }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["assistant_id", "name", "email", "question"].includes(key))) {
    return publicChatJson(request, { success: false, message: "Please check your details and try again." }, { status: 400 });
  }
  const lead = parseLeadInput(record);
  const assistantId = record.assistant_id;
  if (!lead || typeof assistantId !== "string" || !assistantIdPattern.test(assistantId)) {
    return publicChatJson(request, { success: false, message: "Please enter your name, a valid email, and your question." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: profile, error } = await admin.from("profiles")
      .select("allowed_domains")
      .eq("assistant_id", assistantId)
      .maybeSingle();
    if (error) {
      console.error("[lead-webhook]", { stage: "assistant-lookup", code: "ASSISTANT_LOOKUP_FAILED" });
      return publicChatJson(request, { success: false, message: "Lead submission is temporarily unavailable. Please try again." }, { status: 503 });
    }
    if (!profile || !isAllowedAssistantOrigin(request, profile.allowed_domains)) {
      return publicChatJson(request, { success: false, message: "This assistant is not available from this website." }, { status: 403 }, profile?.allowed_domains);
    }

    const rateLimit = await checkPublicChatRateLimit(request, assistantId);
    if (rateLimit.status === "service_unavailable") {
      return publicChatJson(request, { success: false, message: "Lead submission is temporarily unavailable. Please try again." }, { status: 503 }, profile.allowed_domains);
    }
    if (rateLimit.status === "rate_limited") {
      const response = publicChatJson(request, { success: false, message: "Please wait a moment before trying again." }, { status: 429 }, profile.allowed_domains);
      if (rateLimit.retryAfter) response.headers.set("Retry-After", String(rateLimit.retryAfter));
      return response;
    }

    const result = await deliverLeadToWebhook(
      process.env.N8N_WEBHOOK_URL,
      createLeadWebhookPayload(lead),
    );
    if (!result.ok) {
      const failure = describeLeadWebhookFailure(result);
      console.error("[lead-webhook]", {
        stage: "delivery",
        code: failure.code,
        ...(failure.upstreamStatus ? { status: failure.upstreamStatus } : {}),
      });
      return publicChatJson(request, {
        success: false,
        code: failure.code,
        message: failure.message,
      }, { status: failure.status }, profile.allowed_domains);
    }
    return publicChatJson(request, { success: true, message: "Lead submitted successfully" }, undefined, profile.allowed_domains);
  } catch {
    console.error("[lead-webhook]", { stage: "request", code: "LEAD_REQUEST_FAILED" });
    return publicChatJson(request, { success: false, message: "Lead submission is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
