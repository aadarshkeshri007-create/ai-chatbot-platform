import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const view = new URL(request.url).searchParams.get("view") ?? "active";
  const selectedView = view === "resolved" || view === "archived" ? view : "active";
  const requestedPage = Number(new URL(request.url).searchParams.get("page") ?? 0);
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 0 ? Math.min(requestedPage, 10000) : 0;
  let query = supabase
    .from("handoff_requests")
    .select("id, assistant_id, conversation_id, customer_name, customer_email, reason, latest_message, status, created_at, updated_at, archived_at")
    .eq("owner_user_id", user.id)
    .order("updated_at", { ascending: false })
    .range(page * 100, page * 100 + 100);
  if (selectedView === "archived") query = query.not("archived_at", "is", null);
  else {
    query = query.is("archived_at", null);
    query = selectedView === "resolved" ? query.eq("status", "resolved") : query.neq("status", "resolved");
  }
  const { data: handoffs, error } = await query;
  if (error) {
    console.error("[handoffs] list-failed");
    return NextResponse.json({ error: "Unable to load support requests." }, { status: 500 });
  }

  const statuses = ["open", "in_progress", "waiting_for_customer", "resolved"] as const;
  const statusResults = await Promise.all(statuses.map(async (status) => {
    const { count, error: countError } = await supabase
      .from("handoff_requests")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", user.id)
      .eq("status", status)
      .is("archived_at", null);
    return { status, count, error: countError };
  }));
  if (statusResults.some((result) => result.error)) {
    console.error("[handoffs] counts-failed");
    return NextResponse.json({ error: "Unable to load support request counts." }, { status: 500 });
  }
  const { count: archivedCount, error: archivedCountError } = await supabase
    .from("handoff_requests")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", user.id)
    .not("archived_at", "is", null);
  if (archivedCountError) {
    console.error("[handoffs] archived-count-failed");
    return NextResponse.json({ error: "Unable to load support request counts." }, { status: 500 });
  }

  const pageHandoffs = (handoffs ?? []).slice(0, 100);
  const ids = pageHandoffs.map((handoff) => handoff.id);
  let latestHumanMessageAt = new Map<string, string>();
  if (ids.length) {
    const { data: messages, error: messagesError } = await supabase
      .from("handoff_messages")
      .select("handoff_id, created_at")
      .eq("role", "human")
      .in("handoff_id", ids)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (messagesError) {
      console.error("[handoffs] human-messages-lookup-failed");
    }
    latestHumanMessageAt = new Map();
    for (const message of messages ?? []) {
      if (!latestHumanMessageAt.has(message.handoff_id)) {
        latestHumanMessageAt.set(message.handoff_id, message.created_at);
      }
    }
  }

  return NextResponse.json({
    handoffs: pageHandoffs.map((handoff) => ({
      ...handoff,
      latest_human_message_at: latestHumanMessageAt.get(handoff.id) ?? null,
    })),
    counts: Object.fromEntries(statusResults.map(({ status, count }) => [status, count ?? 0])),
    archivedCount: archivedCount ?? 0,
    hasMore: (handoffs?.length ?? 0) > 100,
    page,
  });
}
