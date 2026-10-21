import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createInstallationChallenge } from "@/lib/widget-installation";
import { getConfiguredPublicChatOrigins } from "@/lib/public-chat-cors";
import { getAllowedPublicChatOrigin, normalizeOrigin } from "@/lib/public-chat-origin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter a valid website origin." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body) || typeof (body as { origin?: unknown }).origin !== "string") {
    return NextResponse.json({ error: "Enter a valid website origin." }, { status: 400 });
  }

  const originInput = (body as { origin: string }).origin.trim();
  const normalizedOrigin = normalizeOrigin(originInput);
  if (!normalizedOrigin || normalizedOrigin.origin !== originInput) {
    return NextResponse.json({ error: "Enter a full website origin, such as https://support.example.com." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("assistant_id, allowed_domains")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile?.assistant_id) {
    return NextResponse.json({ error: "Unable to load your assistant configuration." }, { status: 500 });
  }

  if (!getAllowedPublicChatOrigin(normalizedOrigin.origin, request.url, getConfiguredPublicChatOrigins(), profile.allowed_domains)) {
    return NextResponse.json({
      error: "This origin must be allowed in the deployment CORS list and the assistant's Allowed Domains before it can be verified.",
    }, { status: 400 });
  }

  const challenge = createInstallationChallenge();
  try {
    const admin = createAdminClient();
    const { data: inserted, error } = await admin.from("widget_installation_checks").insert({
      assistant_id: profile.assistant_id,
      owner_user_id: user.id,
      expected_origin: normalizedOrigin.origin,
      token_hash: challenge.tokenHash,
      expires_at: challenge.expiresAt,
    }).select("id").single();
    if (error || !inserted) return NextResponse.json({ error: "Unable to create an installation check." }, { status: 503 });
    return NextResponse.json({ id: inserted.id, token: challenge.token, expires_at: challenge.expiresAt });
  } catch {
    return NextResponse.json({ error: "Unable to create an installation check." }, { status: 503 });
  }
}
