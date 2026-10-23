import { createAdminClient } from "@/lib/supabase/admin";
import { getConfiguredPublicChatOrigins, hasDisallowedPublicChatOrigin, isAllowedAssistantOrigin, publicChatJson, publicChatOptions } from "@/lib/public-chat-cors";
import { getAllowedPublicChatOrigin } from "@/lib/public-chat-origin";
import { completeInstallationVerification, hashInstallationToken } from "@/lib/widget-installation";

const assistantIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function OPTIONS(request: Request) {
  if (hasDisallowedPublicChatOrigin(request)) return publicChatJson(request, { error: "Origin is not allowed." }, { status: 403 });
  return publicChatOptions(request);
}

export async function POST(request: Request) {
  if (hasDisallowedPublicChatOrigin(request)) return publicChatJson(request, { error: "Origin is not allowed." }, { status: 403 });
  const origin = request.headers.get("origin");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return publicChatJson(request, { error: "Invalid installation check." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return publicChatJson(request, { error: "Invalid installation check." }, { status: 400 });
  const { assistant_id: assistantId, token } = body as { assistant_id?: unknown; token?: unknown };
  if (typeof assistantId !== "string" || !assistantIdPattern.test(assistantId) || typeof token !== "string" || token.length < 40 || token.length > 100 || !origin) {
    return publicChatJson(request, { error: "Invalid installation check." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: challenge, error: challengeError } = await admin
      .from("widget_installation_checks")
      .select("id, assistant_id, expected_origin, token_hash, expires_at, status")
      .eq("assistant_id", assistantId)
      .eq("token_hash", hashInstallationToken(token))
      .maybeSingle();
    if (challengeError) return publicChatJson(request, { code: "VERIFICATION_UNAVAILABLE", error: "Installation verification is unavailable." }, { status: 503 });
    if (!challenge) return publicChatJson(request, { code: "CHALLENGE_NOT_FOUND", error: "Installation check not found." }, { status: 404 });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("allowed_domains")
      .eq("assistant_id", assistantId)
      .maybeSingle();
    if (profileError) return publicChatJson(request, { code: "ASSISTANT_LOOKUP_FAILED", error: "Assistant configuration is unavailable." }, { status: 503 });
    if (!profile) return publicChatJson(request, { code: "ASSISTANT_NOT_FOUND", error: "Assistant is unavailable." }, { status: 404 });
    if (!getAllowedPublicChatOrigin(origin, request.url, getConfiguredPublicChatOrigins(), profile.allowed_domains) ||
      !isAllowedAssistantOrigin(request, profile.allowed_domains)) {
      return publicChatJson(request, { error: "Installation check did not match the expected website." }, { status: 403 }, profile.allowed_domains);
    }

    const result = await completeInstallationVerification({
      challenge,
      assistantId,
      token,
      actualOrigin: origin,
      persist: async (challengeId, now) => {
        const { data: updated, error: updateError } = await admin
          .from("widget_installation_checks")
          .update({ status: "verified", verified_at: now })
          .eq("id", challengeId)
          .eq("status", "pending")
          .gt("expires_at", now)
          .select("id")
          .maybeSingle();
        if (updateError) return "error";
        return updated ? "updated" : "conflict";
      },
    });
    if (result === "expired") return publicChatJson(request, { code: "CHALLENGE_EXPIRED", error: "Installation check expired." }, { status: 410 }, profile.allowed_domains);
    if (result === "already_used") return publicChatJson(request, { code: "CHALLENGE_ALREADY_USED", error: "Installation check was already used." }, { status: 409 }, profile.allowed_domains);
    if (result === "wrong_origin") return publicChatJson(request, { code: "ORIGIN_MISMATCH", error: "Installation check did not match the expected website." }, { status: 403 }, profile.allowed_domains);
    if (result === "wrong_assistant") return publicChatJson(request, { code: "CHALLENGE_NOT_FOUND", error: "Installation check not found." }, { status: 404 }, profile.allowed_domains);
    if (result === "not_found") return publicChatJson(request, { code: "CHALLENGE_NOT_FOUND", error: "Installation check not found." }, { status: 404 }, profile.allowed_domains);
    if (result === "unavailable") return publicChatJson(request, { code: "VERIFICATION_UNAVAILABLE", error: "Installation verification is unavailable." }, { status: 503 }, profile.allowed_domains);
    return publicChatJson(request, { verified: true, status: "verified" }, undefined, profile.allowed_domains);
  } catch {
    return publicChatJson(request, { code: "VERIFICATION_UNAVAILABLE", error: "Installation verification is unavailable." }, { status: 503 });
  }
}
