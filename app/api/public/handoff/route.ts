import {
  HANDOFF_MAX_MESSAGE_LENGTH,
  HANDOFF_MAX_REASON_LENGTH,
  createHandoffAccessToken,
  createHandoffTokenHash,
  normalizeEmail,
  normalizeOptionalText,
  parseTranscript,
} from "@/lib/handoff";
import { sendHandoffNotification } from "@/lib/handoff-email";
import {
  hasDisallowedPublicChatOrigin,
  isAllowedAssistantOrigin,
  publicChatJson,
  publicChatOptions,
} from "@/lib/public-chat-cors";
import { checkPublicChatRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashWidgetSessionToken, WIDGET_SESSION_TOKEN_PATTERN } from "@/lib/widget-conversation";
import { isMissingSchemaFieldError } from "@/lib/supabase/error";

const assistantIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const latestMessage = normalizeOptionalText(body.latest_message, HANDOFF_MAX_MESSAGE_LENGTH);
    if (!reason) return genericError(request);

    const customerName = normalizeOptionalText(body.customer_name, 120);
    const customerEmail = body.customer_email === undefined
      ? null
      : normalizeEmail(body.customer_email);
    if (body.customer_email !== undefined && body.customer_email !== null && !customerEmail) {
      return genericError(request);
    }

    let conversationId: string | null = null;
    if (body.conversation_id !== undefined && body.conversation_id !== null) {
      if (typeof body.conversation_id !== "string" || !assistantIdPattern.test(body.conversation_id) ||
          typeof body.session_token !== "string" || !WIDGET_SESSION_TOKEN_PATTERN.test(body.session_token)) {
        return genericError(request);
      }
      const { data: linkedConversation, error: linkedConversationError } = await supabase.from("conversations")
        .select("id")
        .eq("id", body.conversation_id)
        .eq("assistant_id", assistantId)
        .eq("visitor_session_hash", hashWidgetSessionToken(body.session_token))
        .maybeSingle();
      if (linkedConversationError) return genericError(request, 503);
      if (!linkedConversation) return genericError(request, 403);
      conversationId = linkedConversation.id;
    }

    const transcript = parseTranscript(body.transcript);
    const access = createHandoffAccessToken();
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
    if (insertError || !handoff) {
      console.error("[public-handoff] request-create-failed");
      return genericError(request, 503);
    }

    if (transcript.length > 0) {
      const { error: messageError } = await supabase.from("handoff_messages").insert(
        transcript.filter((message) => message.role === "user").map((message) => ({
          handoff_id: handoff.id,
          role: "customer",
          content: message.content,
        })),
      );
      if (messageError) console.error("[public-handoff] transcript-save-failed");
    }

    try {
      const { data: owner } = await supabase.auth.admin.getUserById(profile.id);
      const ownerEmail = owner.user?.email;
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
    const { data: handoff } = await supabase
      .from("handoff_requests")
      .select("id, assistant_id, status, public_token_hash")
      .eq("id", handoffId)
      .eq("public_token_hash", createHandoffTokenHash(token))
      .maybeSingle();
    if (!handoff) return genericError(request, 404);

    const { data: profile } = await supabase
      .from("profiles")
      .select("allowed_domains")
      .eq("assistant_id", handoff.assistant_id)
      .maybeSingle();
    if (!profile || !isAllowedAssistantOrigin(request, profile.allowed_domains)) {
      return publicChatJson(request, { error: "This assistant is not available from this website." }, { status: 403 }, profile?.allowed_domains);
    }

    const { data: messages } = await supabase
      .from("handoff_messages")
      .select("id, role, content, created_at")
      .eq("handoff_id", handoff.id)
      .eq("role", "human")
      .order("created_at", { ascending: true });

    return publicChatJson(request, {
      status: handoff.status,
      messages: messages ?? [],
    }, undefined, profile.allowed_domains);
  } catch {
    console.error("[public-handoff] status-failed");
    return genericError(request, 503);
  }
}
