import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  authorizeHandoffUpdate,
  isValidHandoffStatus,
  isValidHandoffTransition,
} from "@/lib/handoff-resolution";

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
  const auth = authorizeHandoffUpdate(user, handoff);
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { handoff: authedHandoff } = auth;

  const { data: messages, error } = await supabase
    .from("handoff_messages")
    .select("id, role, content, created_at")
    .eq("handoff_id", authedHandoff.id)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[handoffs] detail-failed");
    return NextResponse.json({ error: "Unable to load the support conversation." }, { status: 500 });
  }
  return NextResponse.json({ handoff: authedHandoff, messages: messages ?? [] });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ handoffId: string }> },
) {
  const { handoffId } = await params;
  const { supabase, user, handoff } = await getOwnerContext(handoffId);
  const auth = authorizeHandoffUpdate(user, handoff);
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { user: authedUser, handoff: authedHandoff } = auth;

  const body = await request.json().catch(() => null) as { status?: unknown } | null;
  if (!body || !isValidHandoffStatus(body.status)) {
    return NextResponse.json({ error: "Invalid support request status." }, { status: 400 });
  }
  if (!isValidHandoffTransition(authedHandoff.status, body.status)) {
    return NextResponse.json({ error: "Resolved support requests cannot be reopened." }, { status: 409 });
  }
  const { data: updated, error } = await supabase
    .from("handoff_requests")
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq("id", authedHandoff.id)
    .eq("owner_user_id", authedUser.id)
    .eq("status", authedHandoff.status)
    .select("id, status, updated_at")
    .maybeSingle();
  if (error) {
    console.error("[handoffs] status-update-failed");
    return NextResponse.json({ error: "Unable to update the support request." }, { status: 500 });
  }
  if (!updated) return NextResponse.json({ error: "The support request changed. Refresh and try again." }, { status: 409 });
  return NextResponse.json({ handoff: updated });
}
