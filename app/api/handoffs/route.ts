import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: handoffs, error } = await supabase
    .from("handoff_requests")
    .select("id, assistant_id, customer_name, customer_email, reason, latest_message, status, created_at, updated_at")
    .eq("owner_user_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("[handoffs] list-failed");
    return NextResponse.json({ error: "Unable to load support requests." }, { status: 500 });
  }

  return NextResponse.json({ handoffs: handoffs ?? [] });
}
