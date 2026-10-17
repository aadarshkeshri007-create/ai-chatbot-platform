import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STATUSES = new Set(["open", "in_progress", "waiting_for_customer", "resolved"]);

async function getOwnerContext(handoffId: string) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { supabase, user: null, handoff: null };
  const { data: handoff } = await supabase
    .from("handoff_requests")
    .select("id, assistant_id, customer_name, customer_email, reason, latest_message, transcript, status, created_at, updated_at")
    .eq("id", handoffId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  return { supabase, user, handoff };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handoffId: string }> },
) {
  const { handoffId } = await params;
  const { supabase, user, handoff } = await getOwnerContext(handoffId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!handoff) return NextResponse.json({ error: "Support request not found." }, { status: 404 });

  const { data: messages, error } = await supabase
    .from("handoff_messages")
    .select("id, role, content, created_at")
    .eq("handoff_id", handoff.id)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[handoffs] detail-failed");
    return NextResponse.json({ error: "Unable to load the support conversation." }, { status: 500 });
  }
  return NextResponse.json({ handoff, messages: messages ?? [] });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ handoffId: string }> },
) {
  const { handoffId } = await params;
  const { supabase, user, handoff } = await getOwnerContext(handoffId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!handoff) return NextResponse.json({ error: "Support request not found." }, { status: 404 });

  const body = await request.json().catch(() => null) as { status?: unknown } | null;
  if (!body || typeof body.status !== "string" || !STATUSES.has(body.status)) {
    return NextResponse.json({ error: "Invalid support request status." }, { status: 400 });
  }
  const { data: updated, error } = await supabase
    .from("handoff_requests")
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq("id", handoff.id)
    .eq("owner_user_id", user.id)
    .select("id, status, updated_at")
    .single();
  if (error || !updated) {
    console.error("[handoffs] status-update-failed");
    return NextResponse.json({ error: "Unable to update the support request." }, { status: 500 });
  }
  return NextResponse.json({ handoff: updated });
}
