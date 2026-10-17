import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ handoffId: string }> },
) {
  const { handoffId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: handoff } = await supabase
    .from("handoff_requests")
    .select("id")
    .eq("id", handoffId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!handoff) return NextResponse.json({ error: "Support request not found." }, { status: 404 });

  const body = await request.json().catch(() => null) as { content?: unknown } | null;
  if (!body || typeof body.content !== "string" || !body.content.trim() || body.content.trim().length > 8000) {
    return NextResponse.json({ error: "Reply must be between 1 and 8,000 characters." }, { status: 400 });
  }

  const { data: message, error: messageError } = await supabase
    .from("handoff_messages")
    .insert({ handoff_id: handoff.id, role: "human", content: body.content.trim() })
    .select("id, role, content, created_at")
    .single();
  if (messageError || !message) {
    console.error("[handoffs] reply-save-failed");
    return NextResponse.json({ error: "Unable to save the reply." }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("handoff_requests")
    .update({ status: "in_progress", updated_at: new Date().toISOString() })
    .eq("id", handoff.id)
    .eq("owner_user_id", user.id);
  if (updateError) console.error("[handoffs] reply-status-update-failed");

  return NextResponse.json({ message });
}
