import { createHandoffAccessToken } from "@/lib/handoff";
import { createLeadWebhookPayload, deliverLeadToWebhook, describeLeadWebhookFailure, parseLeadInput } from "@/lib/lead-webhook";
import { publicChatJson, publicChatOptions, hasDisallowedPublicChatOrigin, isAllowedAssistantOrigin } from "@/lib/public-chat-cors";
import { checkPublicChatRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingSchemaFieldError } from "@/lib/supabase/error";

export const runtime = "nodejs";

const assistantIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
  if (Object.keys(record).some((key) => !["assistant_id", "name", "email", "question", "request_id"].includes(key))) {
    return publicChatJson(request, { success: false, message: "Please check your details and try again." }, { status: 400 });
  }
  const lead = parseLeadInput(record);
  const assistantId = record.assistant_id;
  if (!lead || typeof assistantId !== "string" || !assistantIdPattern.test(assistantId)) {
    return publicChatJson(request, { success: false, message: "Please enter your name, a valid email, and your question." }, { status: 400 });
  }
  if (record.request_id !== undefined && record.request_id !== null && (typeof record.request_id !== "string" || !requestIdPattern.test(record.request_id))) {
    return publicChatJson(request, { success: false, message: "Please check your details and try again." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    let { data: profile, error } = await admin.from("profiles")
      .select("id, assistant_id, allowed_domains, handoff_enabled")
      .eq("assistant_id", assistantId)
      .maybeSingle();
    if (isMissingSchemaFieldError(error)) {
      ({ data: profile, error } = await admin.from("profiles")
        .select("id, assistant_id, allowed_domains")
        .eq("assistant_id", assistantId)
        .maybeSingle());
    }
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

    // 1. Deduplication check: protect against rapid repeat clicks or retries within 60s
    const recentCutoff = new Date(Date.now() - 60_000).toISOString();
    let { data: existingLead, error: dedupError } = await admin
      .from("leads")
      .select("id, created_at, webhook_delivery_status, webhook_attempts, webhook_last_error")
      .eq("assistant_id", assistantId)
      .eq("email", lead.email)
      .eq("question", lead.question)
      .gte("created_at", recentCutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (isMissingSchemaFieldError(dedupError)) {
      ({ data: existingLead, error: dedupError } = await admin
        .from("leads")
        .select("id, created_at")
        .eq("assistant_id", assistantId)
        .eq("email", lead.email)
        .eq("question", lead.question)
        .gte("created_at", recentCutoff)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle());
    }

    if (dedupError) {
      console.error("[lead-intake]", { stage: "deduplication", code: "LEAD_DEDUPLICATION_CHECK_FAILED" });
      return publicChatJson(request, {
        success: false,
        message: "Lead submission is temporarily unavailable. Please try again.",
      }, { status: 503 }, profile.allowed_domains);
    }

    if (existingLead) {
      const typedLead = existingLead as {
        id: string;
        created_at: string;
        webhook_delivery_status?: string;
        webhook_attempts?: number;
        webhook_last_error?: string | null;
      };

      if (typedLead.webhook_delivery_status === "acknowledged") {
        return publicChatJson(request, {
          success: true,
          message: "Lead submitted successfully",
          lead_id: typedLead.id,
          deduplicated: true,
          delivered: true,
        }, undefined, profile.allowed_domains);
      }

      if (typedLead.webhook_delivery_status === "uncertain") {
        return publicChatJson(request, {
          success: true,
          message: "Lead submitted successfully",
          lead_id: typedLead.id,
          deduplicated: true,
          delivered: false,
          delivery_code: "N8N_DELIVERY_UNCERTAIN",
          uncertain: true,
        }, undefined, profile.allowed_domains);
      }

      if (typedLead.webhook_delivery_status === "failed") {
        const attempts = typedLead.webhook_attempts ?? 0;
        if (attempts < 3) {
          const retryResult = await deliverLeadToWebhook(
            process.env.N8N_WEBHOOK_URL,
            createLeadWebhookPayload(lead, new Date(typedLead.created_at)),
            process.env.N8N_WEBHOOK_SECRET,
          );
          if (retryResult.ok) {
            try {
              await admin.from("leads").update({
                webhook_delivery_status: "acknowledged",
                webhook_acknowledged_at: new Date().toISOString(),
                webhook_attempts: attempts + 1,
                webhook_last_error: null,
              }).eq("id", typedLead.id);
            } catch {
              // Ignore schema mismatch
            }
            return publicChatJson(request, {
              success: true,
              message: "Lead submitted successfully",
              lead_id: typedLead.id,
              deduplicated: true,
              delivered: true,
            }, undefined, profile.allowed_domains);
          }

          const failure = describeLeadWebhookFailure(retryResult);
          const isTimeout = retryResult.reason === "timeout";
          try {
            await admin.from("leads").update({
              webhook_delivery_status: isTimeout ? "uncertain" : "failed",
              webhook_attempts: attempts + 1,
              webhook_last_error: failure.code,
            }).eq("id", typedLead.id);
          } catch {
            // Ignore schema mismatch
          }
          return publicChatJson(request, {
            success: true,
            message: "Lead submitted successfully",
            lead_id: typedLead.id,
            deduplicated: true,
            delivered: false,
            delivery_code: failure.code,
            ...(isTimeout ? { uncertain: true } : {}),
          }, undefined, profile.allowed_domains);
        }

        return publicChatJson(request, {
          success: true,
          message: "Lead submitted successfully",
          lead_id: typedLead.id,
          deduplicated: true,
          delivered: false,
          delivery_code: typedLead.webhook_last_error || "MAX_DELIVERY_ATTEMPTS_EXCEEDED",
        }, undefined, profile.allowed_domains);
      }

      return publicChatJson(request, {
        success: true,
        message: "Lead submitted successfully",
        lead_id: typedLead.id,
        deduplicated: true,
      }, undefined, profile.allowed_domains);
    }

    // 2. Persist lead durably into public.leads before informing visitor
    const leadInsertPayload: Record<string, unknown> = {
      assistant_id: assistantId,
      name: lead.name,
      email: lead.email,
      question: lead.question,
      webhook_delivery_status: "pending",
      webhook_attempts: 0,
    };
    if (typeof record.request_id === "string") {
      leadInsertPayload.request_id = record.request_id;
    }

    let { data: savedLead, error: insertError } = await admin
      .from("leads")
      .insert(leadInsertPayload)
      .select("id, created_at")
      .single();

    if (isMissingSchemaFieldError(insertError)) {
      ({ data: savedLead, error: insertError } = await admin
        .from("leads")
        .insert({
          assistant_id: assistantId,
          name: lead.name,
          email: lead.email,
          question: lead.question,
        })
        .select("id, created_at")
        .single());
    }

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: racedLead, error: racedError } = await admin
          .from("leads")
          .select("id, created_at")
          .eq("assistant_id", assistantId)
          .eq("email", lead.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!racedError && racedLead) {
          return publicChatJson(request, {
            success: true,
            message: "Lead submitted successfully",
            lead_id: racedLead.id,
            deduplicated: true,
          }, undefined, profile.allowed_domains);
        }
      }

      console.error("[lead-intake]", { stage: "persistence", code: "LEAD_PERSISTENCE_FAILED" });
      return publicChatJson(request, {
        success: false,
        message: "Lead submission is temporarily unavailable. Please try again.",
      }, { status: 503 }, profile.allowed_domains);
    }

    if (!savedLead) {
      console.error("[lead-intake]", { stage: "persistence", code: "LEAD_PERSISTENCE_FAILED" });
      return publicChatJson(request, {
        success: false,
        message: "Lead submission is temporarily unavailable. Please try again.",
      }, { status: 503 }, profile.allowed_domains);
    }

    // 3. Sync to owner's dashboard handoff inbox so the business can see and act on it
    if (profile.id && profile.handoff_enabled !== false) {
      try {
        const access = createHandoffAccessToken();
        const { error: handoffInsertError } = await admin.from("handoff_requests").insert({
          assistant_id: assistantId,
          owner_user_id: profile.id,
          customer_name: lead.name,
          customer_email: lead.email,
          reason: lead.question,
          latest_message: lead.question,
          transcript: [{ role: "user", content: lead.question }],
          public_token_hash: access.hash,
          status: "open",
        });
        if (handoffInsertError) {
          console.error("[lead-intake]", { stage: "handoff-sync", code: "HANDOFF_SYNC_FAILED" });
        }
      } catch {
        console.error("[lead-intake]", { stage: "handoff-sync", code: "HANDOFF_SYNC_DEFERRED" });
      }
    }

    // 4. Deliver lead to configured n8n webhook (decoupled from lead persistence)
    const result = await deliverLeadToWebhook(
      process.env.N8N_WEBHOOK_URL,
      createLeadWebhookPayload(lead, new Date(savedLead.created_at)),
      process.env.N8N_WEBHOOK_SECRET,
    );

    if (!result.ok) {
      const failure = describeLeadWebhookFailure(result);
      const isTimeout = result.reason === "timeout";
      try {
        await admin.from("leads").update({
          webhook_delivery_status: isTimeout ? "uncertain" : "failed",
          webhook_attempts: 1,
          webhook_last_error: failure.code,
        }).eq("id", savedLead.id);
      } catch {
        // Ignore schema mismatch
      }

      console.error("[lead-webhook]", {
        stage: "delivery",
        code: failure.code,
        lead_id: savedLead.id,
        ...(failure.upstreamStatus ? { status: failure.upstreamStatus } : {}),
      });

      return publicChatJson(request, {
        success: true,
        message: "Lead submitted successfully",
        lead_id: savedLead.id,
        delivered: false,
        delivery_code: failure.code,
        ...(isTimeout ? { uncertain: true } : {}),
      }, undefined, profile.allowed_domains);
    }

    try {
      await admin.from("leads").update({
        webhook_delivery_status: "acknowledged",
        webhook_acknowledged_at: new Date().toISOString(),
        webhook_attempts: 1,
        webhook_last_error: null,
      }).eq("id", savedLead.id);
    } catch {
      // Ignore schema mismatch
    }

    return publicChatJson(request, {
      success: true,
      message: "Lead submitted successfully",
      lead_id: savedLead.id,
      delivered: true,
    }, undefined, profile.allowed_domains);
  } catch {
    console.error("[lead-webhook]", { stage: "request", code: "LEAD_REQUEST_FAILED" });
    return publicChatJson(request, { success: false, message: "Lead submission is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
