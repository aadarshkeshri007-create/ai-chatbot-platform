import { NextResponse } from "next/server";
import { mergeHandoffTranscript } from "@/lib/handoff-transcript";
import { safeWidgetSources } from "@/lib/widget-conversation";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  const id = params.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || (kind !== "ai" && kind !== "handoff" && kind !== "mixed")) {
    return NextResponse.json({ error: "Invalid history selection." }, { status: 400 });
  }

  if (kind === "ai" || kind === "mixed") {
    const { data: ownerProfile } = await supabase.from("profiles").select("assistant_id").eq("id", user.id).maybeSingle();
    let { data: conversation } = await supabase.from("conversations")
      .select("id, title, created_at, updated_at, assistant_id").eq("id", id).eq("user_id", user.id).eq("is_test", false).maybeSingle();
    if (!conversation && ownerProfile?.assistant_id) {
      const { data: visitorConversation } = await supabase.from("conversations")
        .select("id, title, created_at, updated_at, assistant_id")
        .eq("id", id).eq("assistant_id", ownerProfile.assistant_id).is("user_id", null).eq("is_test", false).maybeSingle();
      conversation = visitorConversation;
    }
    if (!conversation && kind === "mixed" && params.get("handoffId") === id) {
      const { data: unlinkedHandoff } = await supabase.from("handoff_requests")
        .select("id, conversation_id, customer_name, customer_email, reason, latest_message, transcript, status, archived_at, created_at, updated_at")
        .eq("id", id).eq("owner_user_id", user.id).is("conversation_id", null).maybeSingle();
      if (!unlinkedHandoff) return NextResponse.json({ error: "History item not found." }, { status: 404 });
      const { data: persisted, error } = await supabase.from("handoff_messages")
        .select("id, role, content, created_at").eq("handoff_id", id).order("created_at", { ascending: true });
      if (error) {
        console.error("[history] mixed-handoff-detail-failed");
        return NextResponse.json({ error: "Unable to load conversation history." }, { status: 500 });
      }
      const snapshot = Array.isArray(unlinkedHandoff.transcript)
        ? unlinkedHandoff.transcript.filter((item): item is { role: "user" | "assistant"; content: string; created_at?: string } =>
          Boolean(item && typeof item === "object" &&
            ((item as { role?: unknown }).role === "user" || (item as { role?: unknown }).role === "assistant") &&
            typeof (item as { content?: unknown }).content === "string"),
        )
        : [];
      return NextResponse.json({ handoff: unlinkedHandoff, messages: mergeHandoffTranscript(snapshot, persisted ?? []) });
    }
    if (!conversation) return NextResponse.json({ error: "History item not found." }, { status: 404 });
    const { data: storedMessages, error } = await supabase.from("messages")
      .select("id, role, content, created_at, sources").eq("conversation_id", id).order("created_at", { ascending: true });
    if (error) {
      console.error("[history] detail-failed");
      return NextResponse.json({ error: "Unable to load conversation history." }, { status: 500 });
    }

    let handoff: Record<string, unknown> | null = null;
    let humanMessages: Array<{ id: string; role: string; content: string; created_at: string }> = [];
    if (kind === "mixed") {
      const handoffId = params.get("handoffId");
      if (!handoffId || !/^[0-9a-f-]{36}$/i.test(handoffId)) {
        return NextResponse.json({ error: "Invalid handoff reference." }, { status: 400 });
      }
      const { data: record } = await supabase.from("handoff_requests")
        .select("id, status, archived_at, customer_name, customer_email, reason, transcript, created_at, updated_at")
        .eq("id", handoffId).eq("owner_user_id", user.id).eq("conversation_id", id).maybeSingle();
      if (!record) return NextResponse.json({ error: "History item not found." }, { status: 404 });
      handoff = record;
      const { data, error: messagesError } = await supabase.from("handoff_messages")
        .select("id, role, content, created_at").eq("handoff_id", handoffId).eq("role", "human").order("created_at", { ascending: true });
      if (messagesError) {
        console.error("[history] detail-messages-failed");
        return NextResponse.json({ error: "Unable to load conversation history." }, { status: 500 });
      }
      humanMessages = data ?? [];
    }

    const messages = [
      ...(storedMessages ?? []).map((item) => ({ ...item, sources: safeWidgetSources(item.sources), role: item.role === "user" ? "customer" : item.role })),
      ...humanMessages,
    ].sort((left, right) => left.created_at.localeCompare(right.created_at));
    return NextResponse.json({ conversation, handoff, messages });
  }

  const { data: handoff } = await supabase.from("handoff_requests")
    .select("id, conversation_id, customer_name, customer_email, reason, latest_message, transcript, status, archived_at, created_at, updated_at")
    .eq("id", id).eq("owner_user_id", user.id).maybeSingle();
  if (!handoff) return NextResponse.json({ error: "History item not found." }, { status: 404 });
  if (handoff.conversation_id) {
    // A handoff with a real FK link is represented by the mixed conversation above.
    return NextResponse.json({ redirectKind: "mixed", id: handoff.conversation_id, handoffId: handoff.id });
  }
  const { data: persisted, error } = await supabase.from("handoff_messages")
    .select("id, role, content, created_at").eq("handoff_id", id).order("created_at", { ascending: true });
  if (error) {
    console.error("[history] handoff-detail-failed");
    return NextResponse.json({ error: "Unable to load conversation history." }, { status: 500 });
  }
  const snapshot = Array.isArray(handoff.transcript)
    ? handoff.transcript.filter((item): item is { role: "user" | "assistant"; content: string; created_at?: string } =>
      Boolean(item && typeof item === "object" &&
        ((item as { role?: unknown }).role === "user" || (item as { role?: unknown }).role === "assistant") &&
        typeof (item as { content?: unknown }).content === "string"),
    )
    : [];
  const messages = mergeHandoffTranscript(snapshot, persisted ?? []);
  return NextResponse.json({ handoff, messages });
}
