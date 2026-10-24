import {
  HANDOFF_MAX_REASON_LENGTH,
  createHandoffAccessToken,
  createHandoffTokenHash,
  normalizeEmail,
  normalizeOptionalText,
  parseTranscript,
  resolveHandoffLatestMessage,
} from "@/lib/handoff";
import { sendHandoffNotification } from "@/lib/handoff-email";
import { createLeadWebhookPayload, deliverLeadToWebhook, describeLeadWebhookFailure } from "@/lib/lead-webhook";
import {
  hasDisallowedPublicChatOrigin,
  isAllowedAssistantOrigin,
  publicChatJson,
  publicChatOptions,
} from "@/lib/public-chat-cors";
import { checkPublicChatRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingSchemaFieldError } from "@/lib/supabase/error";
import { hashWidgetSessionToken, WIDGET_SESSION_TOKEN_PATTERN } from "@/lib/widget-conversation";
import { expireStaleVisitorConversation } from "@/lib/widget-restore";
import { createSupabaseWidgetRestoreStore } from "@/lib/widget-restore-store";
import { resolveWidgetRetentionDays } from "@/lib/widget-retention";

const assistantIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function genericError(request: Request, status = 400) {
  return publicChatJson(request, { error: "Unable to submit the support request." }, { status });
}

export function OPTIONS(request: Request) {
  if (hasDisallowedPublicChatOrigin(request)) {
    return publicChatJson(request, { error: "Origin is not allowed." }, { status: 403 });
  }
  return publicChatOptions(request, "GET, POST, OPTIONS");
}

export async function POST(request: Request) {
  if (hasDisallowedPublicChatOrigin(request)) {
    return publicChatJson(request, { error: "Origin is not allowed." }, { status: 403 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const assistantId = body.assistant_id;
    if (typeof assistantId !== "string" || !assistantIdPattern.test(assistantId)) {
      return genericError(request);
    }

    const supabase = createAdminClient();
    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, assistant_id, business_name, allowed_domains, handoff_enabled")
      .eq("assistant_id", assistantId)
      .maybeSingle();
    if (isMissingSchemaFieldError(profileError)) {
      ({ data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, assistant_id, business_name, allowed_domains")
        .eq("assistant_id", assistantId)
        .maybeSingle());
    }
    if (profileError || !profile || !isAllowedAssistantOrigin(request, profile.allowed_domains)) {
      return publicChatJson(request, { error: "This assistant is not available from this website." }, { status: 403 }, profile?.allowed_domains);
    }
    if (profile.handoff_enabled === false) {
      return publicChatJson(request, { error: "Support requests are disabled for this assistant." }, { status: 403 }, profile.allowed_domains);
    }

    const rateLimit = await checkPublicChatRateLimit(request, assistantId);
    if (rateLimit.status === "service_unavailable") {
      return genericError(request, 503);
    }
    if (rateLimit.status === "rate_limited") {
      const response = genericError(request, 429);
      if (rateLimit.retryAfter) response.headers.set("Retry-After", String(rateLimit.retryAfter));
      return response;
    }

    const reason = normalizeOptionalText(body.reason, HANDOFF_MAX_REASON_LENGTH);
    if (!reason) return genericError(request);

    const customerName = normalizeOptionalText(body.customer_name, 120);
    const customerEmail = body.customer_email === undefined || body.customer_email === null
      ? null
      : normalizeEmail(body.customer_email);
    if (body.customer_email !== undefined && body.customer_email !== null && !customerEmail) {
      return genericError(request);
    }

    if (
      body.request_id !== undefined &&
      body.request_id !== null &&
      (typeof body.request_id !== "string" || !requestIdPattern.test(body.request_id))
    ) {
      return genericError(request);
    }
    const requestId = typeof body.request_id === "string" ? body.request_id : null;

    if (
      body.session_token !== undefined &&
      body.session_token !== null &&
      (typeof body.session_token !== "string" || !WIDGET_SESSION_TOKEN_PATTERN.test(body.session_token))
    ) {
      return genericError(request);
    }
    const sessionToken = typeof body.session_token === "string" ? body.session_token : null;
    const sessionHash = sessionToken ? hashWidgetSessionToken(sessionToken) : null;

    if (
      body.conversation_id !== undefined &&
      body.conversation_id !== null &&
      typeof body.conversation_id !== "string"
    ) {
      return genericError(request);
    }
    const requestedConversationId =
      typeof body.conversation_id === "string" && body.conversation_id.trim().length > 0
        ? body.conversation_id.trim()
        : null;

    if (requestedConversationId !== null) {
      if (!assistantIdPattern.test(requestedConversationId) || !sessionHash) {
        return genericError(request);
      }
    }

    const idempotencySeed =
      requestId && sessionHash ? `${assistantId}:${sessionHash}:${requestId}` : undefined;
    const access = createHandoffAccessToken(idempotencySeed);

    if (idempotencySeed) {
      const { data: existingHandoff, error: existingHandoffError } = await supabase
        .from("handoff_requests")
        .select("id, status")
        .eq("assistant_id", assistantId)
        .eq("public_token_hash", access.hash)
        .maybeSingle();
      if (existingHandoffError) return genericError(request, 503);
      if (existingHandoff) {
        return publicChatJson(request, {
          success: true,
          handoff_id: existingHandoff.id,
          access_token: access.token,
          status: existingHandoff.status,
          deduplicated: true,
        }, undefined, profile.allowed_domains);
      }
    }

    let conversationId: string | null = null;
    if (sessionHash) {
      let preExpiryOwnedConversation: { id: string } | null = null;
      if (requestedConversationId) {
        const { data: ownedBeforeExpiry, error: ownedError } = await supabase
          .from("conversations")
          .select("id")
          .eq("id", requestedConversationId)
          .eq("assistant_id", assistantId)
          .eq("visitor_session_hash", sessionHash)
          .maybeSingle();
        if (ownedError) return genericError(request, 503);
        if (!ownedBeforeExpiry) return genericError(request, 403);
        preExpiryOwnedConversation = ownedBeforeExpiry;
      }

      const retentionDays = resolveWidgetRetentionDays(process.env.WIDGET_CONVERSATION_RETENTION_DAYS);
      const restoreStore = createSupabaseWidgetRestoreStore(supabase);
      const expired = await expireStaleVisitorConversation(restoreStore, {
        assistantId,
        sessionHash,
        retentionDays,
      });

      if (!expired) {
        if (preExpiryOwnedConversation) {
          conversationId = preExpiryOwnedConversation.id;
        } else {
          const { data: activeConversation, error: activeConvError } = await supabase
            .from("conversations")
            .select("id")
            .eq("assistant_id", assistantId)
            .eq("visitor_session_hash", sessionHash)
            .maybeSingle();
          if (activeConvError) return genericError(request, 503);
          conversationId = activeConversation?.id ?? null;
        }
      }
    }

    const transcript = parseTranscript(body.transcript);
    const latestMessage = resolveHandoffLatestMessage(body.latest_message, transcript, reason);
    const { data: handoff, error: insertError } = await supabase
      .from("handoff_requests")
      .insert({
        assistant_id: assistantId,
        owner_user_id: profile.id,
        conversation_id: conversationId,
        customer_name: customerName,
        customer_email: customerEmail,
        reason,
        latest_message: latestMessage,
        transcript,
        public_token_hash: access.hash,
      })
      .select("id, status, created_at")
      .single();

    if (insertError) {
      if (idempotencySeed && insertError.code === "23505") {
        const { data: racedHandoff, error: racedHandoffError } = await supabase
          .from("handoff_requests")
          .select("id, status")
          .eq("assistant_id", assistantId)
          .eq("public_token_hash", access.hash)
          .maybeSingle();
        if (racedHandoffError) return genericError(request, 503);
        if (racedHandoff) {
          return publicChatJson(request, {
            success: true,
            handoff_id: racedHandoff.id,
            access_token: access.token,
            status: racedHandoff.status,
            deduplicated: true,
          }, undefined, profile.allowed_domains);
        }
      }
      console.error("[public-handoff] request-create-failed");
      return genericError(request, 503);
    }
    if (!handoff) {
      console.error("[public-handoff] request-create-failed");
      return genericError(request, 503);
    }

    const customerMessages = transcript
      .filter((message) => message.role === "user")
      .map((message) => ({
        handoff_id: handoff.id,
        role: "customer" as const,
        content: message.content,
      }));
    if (customerMessages.length > 0) {
      const { error: messageError } = await supabase
        .from("handoff_messages")
        .insert(customerMessages);
      if (messageError) console.error("[public-handoff] transcript-save-failed");
    }

    if (customerEmail) {
      let syncState: "not_needed" | "inserted" | "deduplicated_acknowledged" | "deduplicated_retryable" | "failed" = "not_needed";
      let targetLeadId: string | null = null;
      let targetAttempts = 0;

      try {
        const recentCutoff = new Date(Date.now() - 60_000).toISOString();
        let { data: existingLead, error: checkError } = await supabase
          .from("leads")
          .select("id, webhook_delivery_status, webhook_attempts")
          .eq("assistant_id", assistantId)
          .eq("email", customerEmail)
          .eq("question", reason)
          .gte("created_at", recentCutoff)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (isMissingSchemaFieldError(checkError)) {
          ({ data: existingLead, error: checkError } = await supabase
            .from("leads")
            .select("id")
            .eq("assistant_id", assistantId)
            .eq("email", customerEmail)
            .eq("question", reason)
            .gte("created_at", recentCutoff)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle());
        }

        if (checkError) {
          console.error("[public-handoff]", { stage: "lead-sync-check", code: "LEAD_DEDUPLICATION_CHECK_FAILED" });
          syncState = "failed";
        } else if (existingLead) {
          targetLeadId = existingLead.id;
          const typedExisting = existingLead as { id: string; webhook_delivery_status?: string; webhook_attempts?: number };
          targetAttempts = typedExisting.webhook_attempts ?? 0;
          const status = typedExisting.webhook_delivery_status;

          if (status === "acknowledged") {
            syncState = "deduplicated_acknowledged";
          } else if (status === "uncertain") {
            console.warn("[public-handoff]", { stage: "lead-sync", code: "PREVIOUS_DELIVERY_UNCERTAIN" });
            syncState = "deduplicated_acknowledged";
          } else if (status === "failed") {
            syncState = targetAttempts < 3 ? "deduplicated_retryable" : "deduplicated_acknowledged";
          } else {
            syncState = "deduplicated_acknowledged";
          }
        } else {
          const insertPayload: Record<string, unknown> = {
            assistant_id: assistantId,
            name: customerName || "Website visitor",
            email: customerEmail,
            question: reason,
            webhook_delivery_status: "pending",
            webhook_attempts: 0,
          };
          if (requestId) {
            insertPayload.request_id = requestId;
          }

          let { data: newLead, error: insertError } = await supabase
            .from("leads")
            .insert(insertPayload)
            .select("id")
            .single();

          if (isMissingSchemaFieldError(insertError)) {
            ({ data: newLead, error: insertError } = await supabase
              .from("leads")
              .insert({
                assistant_id: assistantId,
                name: customerName || "Website visitor",
                email: customerEmail,
                question: reason,
              })
              .select("id")
              .single());
          }

          if (insertError?.code === "23505") {
            if (requestId) {
              let { data: racedLead, error: racedError } = await supabase
                .from("leads")
                .select("id, webhook_delivery_status, webhook_attempts")
                .eq("assistant_id", assistantId)
                .eq("request_id", requestId)
                .maybeSingle();

              if (isMissingSchemaFieldError(racedError)) {
                ({ data: racedLead, error: racedError } = await supabase
                  .from("leads")
                  .select("id")
                  .eq("assistant_id", assistantId)
                  .eq("request_id", requestId)
                  .maybeSingle());
              }

              if (!racedError && racedLead) {
                targetLeadId = racedLead.id;
                const typedRaced = racedLead as { id: string; webhook_delivery_status?: string; webhook_attempts?: number };
                targetAttempts = typedRaced.webhook_attempts ?? 0;
                if (typedRaced.webhook_delivery_status === "uncertain") {
                  console.warn("[public-handoff]", { stage: "lead-sync", code: "PREVIOUS_DELIVERY_UNCERTAIN" });
                }
                syncState = "deduplicated_acknowledged";
              } else {
                console.error("[public-handoff]", { stage: "lead-sync-collision", code: "LEAD_SYNC_COLLISION_UNRESOLVED" });
                syncState = "failed";
              }
            } else {
              console.error("[public-handoff]", { stage: "lead-sync-collision", code: "LEAD_SYNC_COLLISION_UNRESOLVED" });
              syncState = "failed";
            }
          } else if (insertError || !newLead) {
            console.error("[public-handoff]", { stage: "lead-sync-insert", code: "LEAD_SYNC_INSERT_FAILED" });
            syncState = "failed";
          } else {
            targetLeadId = newLead.id;
            syncState = "inserted";
          }
        }
      } catch {
        console.error("[public-handoff]", { stage: "lead-sync", code: "LEAD_SYNC_FAILED" });
        syncState = "failed";
      }

      if (syncState === "inserted" || syncState === "deduplicated_retryable") {
        try {
          const webhookUrl = process.env.N8N_WEBHOOK_URL?.trim();
          const webhookSecret = process.env.N8N_WEBHOOK_SECRET?.trim();
          if (webhookUrl && webhookSecret) {
            const deliveryResult = await deliverLeadToWebhook(
              webhookUrl,
              createLeadWebhookPayload({
                name: customerName || "Website visitor",
                email: customerEmail,
                question: reason,
              }),
              webhookSecret,
            );

            if (deliveryResult.ok) {
              if (targetLeadId) {
                try {
                  const { error: updateError } = await supabase.from("leads").update({
                    webhook_delivery_status: "acknowledged",
                    webhook_acknowledged_at: new Date().toISOString(),
                    webhook_attempts: targetAttempts + 1,
                    webhook_last_error: null,
                  }).eq("id", targetLeadId);
                  if (updateError && !isMissingSchemaFieldError(updateError)) {
                    console.error("[public-handoff]", { stage: "lead-status-update", code: "LEAD_STATUS_UPDATE_FAILED" });
                  }
                } catch {
                  // Ignore schema mismatch
                }
              }
            } else {
              const failure = describeLeadWebhookFailure(deliveryResult);
              const isTimeout = deliveryResult.reason === "timeout";
              if (targetLeadId) {
                try {
                  const { error: updateError } = await supabase.from("leads").update({
                    webhook_delivery_status: isTimeout ? "uncertain" : "failed",
                    webhook_attempts: targetAttempts + 1,
                    webhook_last_error: failure.code,
                  }).eq("id", targetLeadId);
                  if (updateError && !isMissingSchemaFieldError(updateError)) {
                    console.error("[public-handoff]", { stage: "lead-status-update", code: "LEAD_STATUS_UPDATE_FAILED" });
                  }
                } catch {
                  // Ignore schema mismatch
                }
              }
              console.error("[public-handoff]", {
                stage: "lead-webhook",
                code: failure.code,
                ...(failure.upstreamStatus ? { status: failure.upstreamStatus } : {}),
              });
            }
          } else {
            console.warn("[public-handoff]", { stage: "lead-webhook", code: "N8N_WEBHOOK_NOT_CONFIGURED" });
          }
        } catch {
          console.error("[public-handoff]", { stage: "lead-webhook", code: "LEAD_WEBHOOK_DISPATCH_FAILED" });
        }
      }
    }

    try {
      const { data: owner, error: ownerError } = await supabase.auth.admin.getUserById(profile.id);
      if (ownerError) {
        console.warn("[public-handoff] owner-lookup-failed");
      }
      const ownerEmail = owner?.user?.email;
      if (ownerEmail) {
        await sendHandoffNotification({
          ownerEmail,
          businessName: profile.business_name || "your business",
          customerName,
          customerEmail,
          reason,
          latestMessage,
          handoffId: handoff.id,
        });
      } else {
        console.warn("[public-handoff] owner-email-unavailable");
      }
    } catch {
      console.error("[public-handoff] notification-failed");
    }

    return publicChatJson(request, {
      success: true,
      handoff_id: handoff.id,
      access_token: access.token,
      status: handoff.status,
    }, undefined, profile.allowed_domains);
  } catch {
    console.error("[public-handoff] request-failed");
    return genericError(request, 503);
  }
}

export async function GET(request: Request) {
  if (hasDisallowedPublicChatOrigin(request)) {
    return publicChatJson(request, { error: "Origin is not allowed." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const handoffId = params.get("handoff_id");
  const token = params.get("access_token");
  if (!handoffId || !token || token.length > 200) return genericError(request);

  try {
    const supabase = createAdminClient();
    const { data: handoff, error: handoffError } = await supabase
      .from("handoff_requests")
      .select("id, assistant_id, status, public_token_hash")
      .eq("id", handoffId)
      .eq("public_token_hash", createHandoffTokenHash(token))
      .maybeSingle();
    if (handoffError) {
      console.error("[public-handoff] handoff-lookup-failed");
      return genericError(request, 503);
    }
    if (!handoff) return genericError(request, 404);

    const { data: profile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("allowed_domains")
      .eq("assistant_id", handoff.assistant_id)
      .maybeSingle();
    if (profileLookupError) {
      console.error("[public-handoff] profile-lookup-failed");
      return genericError(request, 503);
    }
    if (!profile || !isAllowedAssistantOrigin(request, profile.allowed_domains)) {
      return publicChatJson(request, { error: "This assistant is not available from this website." }, { status: 403 }, profile?.allowed_domains);
    }

    const { data: messages, error: messagesError } = await supabase
      .from("handoff_messages")
      .select("id, role, content, created_at")
      .eq("handoff_id", handoff.id)
      .eq("role", "human")
      .order("created_at", { ascending: true });
    if (messagesError) {
      console.error("[public-handoff] messages-lookup-failed");
      return genericError(request, 503);
    }

    return publicChatJson(request, {
      status: handoff.status,
      messages: messages ?? [],
    }, undefined, profile.allowed_domains);
  } catch {
    console.error("[public-handoff] status-failed");
    return genericError(request, 503);
  }
}
