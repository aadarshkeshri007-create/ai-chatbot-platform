import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getInstallationStatusFailure } from "@/lib/installation-status";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ code: "UNAUTHORIZED", error: "Unauthorized." }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("assistant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ code: "ASSISTANT_LOOKUP_FAILED", error: "Unable to load your assistant configuration." }, { status: 503 });
  if (!profile?.assistant_id) return NextResponse.json({ code: "ASSISTANT_NOT_AVAILABLE", error: "Your Assistant ID is not available yet." }, { status: 404 });

  try {
    const admin = createAdminClient();
    const now = new Date();
    const nowIso = now.toISOString();
    const retentionCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // Persist expiry so the dashboard reports the actual lifecycle state.
    const { error: expireError } = await admin
      .from("widget_installation_checks")
      .update({ status: "expired" })
      .eq("owner_user_id", user.id)
      .eq("assistant_id", profile.assistant_id)
      .eq("status", "pending")
      .lte("expires_at", nowIso);
    if (expireError) return NextResponse.json(getInstallationStatusFailure(expireError.code), { status: 503 });

    // Keep recent history while bounding retained challenge rows per owner.
    const { error: cleanupError } = await admin
      .from("widget_installation_checks")
      .delete()
      .eq("owner_user_id", user.id)
      .eq("assistant_id", profile.assistant_id)
      .lt("created_at", retentionCutoff);
    if (cleanupError) return NextResponse.json(getInstallationStatusFailure(cleanupError.code), { status: 503 });

    const { data, error } = await admin
      .from("widget_installation_checks")
      .select("id, expected_origin, status, created_at, expires_at, verified_at")
      .eq("owner_user_id", user.id)
      .eq("assistant_id", profile.assistant_id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return NextResponse.json(getInstallationStatusFailure(error.code), { status: 503 });

    const checks = data ?? [];
    return NextResponse.json({
      checks,
      verified: checks.some((check) => check.status === "verified" && check.verified_at),
    });
  } catch {
    return NextResponse.json({ code: "INSTALLATION_STATUS_UNAVAILABLE", error: "Unable to load installation checks right now. Please retry." }, { status: 503 });
  }
}
