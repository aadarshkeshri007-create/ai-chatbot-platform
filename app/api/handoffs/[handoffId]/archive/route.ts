import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canArchiveHandoff } from "@/lib/handoff-resolution";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ handoffId: string }> },
) {
  const { handoffId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as { archived?: unknown } | null;
  if (!body || typeof body.archived !== "boolean") {
    return NextResponse.json({ error: "Choose whether to archive or restore this support request." }, { status: 400 });
  }

  const { data: handoff } = await supabase
    .from("handoff_requests")
    .select("id, status")
    .eq("id", handoffId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!handoff) return NextResponse.json({ error: "Support request not found." }, { status: 404 });
  if (!canArchiveHandoff(handoff.status)) {
    return NextResponse.json({ error: "Only resolved support requests can be archived." }, { status: 409 });
  }

  const { data: updated, error } = await supabase
    .from("handoff_requests")
    .update({ archived_at: body.archived ? new Date().toISOString() : null })
    .eq("id", handoff.id)
    .eq("owner_user_id", user.id)
    .eq("status", "resolved")
    .select("id, archived_at")
    .maybeSingle();
  if (error) {
    console.error("[handoffs] archive-failed");
    return NextResponse.json({ error: "Unable to update the archive status." }, { status: 500 });
  }
  if (!updated) return NextResponse.json({ error: "The support request changed. Refresh and try again." }, { status: 409 });
  return NextResponse.json({ handoff: updated });
}
