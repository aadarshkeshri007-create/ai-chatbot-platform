import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { filterHistoryEntries, mergeLinkedHandoffs, paginateHistoryEntries, type HistoryEntry, type HistoryFilters } from "@/lib/history";

type ConversationRow = { id: string; title: string | null; updated_at: string; assistant_id: string | null };
type MessageRow = { conversation_id: string; role: string; content: string; created_at: string; sources: unknown };
type HandoffRow = {
  id: string; conversation_id: string | null; customer_name: string | null; customer_email: string | null;
  reason: string; latest_message: string | null; transcript: unknown; status: string;
  created_at: string; updated_at: string; archived_at: string | null;
};
type HandoffMessageRow = { id: string; handoff_id: string; role: string; content: string; created_at: string };

const snippet = (value: string, length = 180) => value.replace(/\s+/g, " ").trim().slice(0, length);

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await fetchPage(offset, offset + pageSize - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}

async function fetchRowsByIds<T>(
  ids: string[],
  fetchPage: (ids: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let index = 0; index < ids.length; index += 50) {
    const batch = ids.slice(index, index + 50);
    const result = await fetchAllPages<T>((from, to) => fetchPage(batch, from, to));
    if (result.error) return result;
    rows.push(...(result.data ?? []));
  }
  return { data: rows, error: null };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? 0);
  const pageSize = Number(searchParams.get("pageSize") ?? 25);
  const archived = searchParams.get("archived");
  const filters: HistoryFilters = {
    search: searchParams.get("search") ?? "",
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
    status: searchParams.get("status") ?? "all",
    kind: searchParams.get("kind") ?? "all",
    archived: archived === "archived" || archived === "all" ? archived : "active",
  };

  const { data: ownerProfile } = await supabase.from("profiles").select("assistant_id").eq("id", user.id).maybeSingle();
  const [ownedConversationResult, visitorConversationResult, handoffResult] = await Promise.all([
    fetchAllPages<ConversationRow>((from, to) => supabase.from("conversations")
      .select("id, title, updated_at, assistant_id").eq("user_id", user.id)
      .eq("is_test", false)
      .order("updated_at", { ascending: false }).range(from, to)),
    ownerProfile?.assistant_id
      ? fetchAllPages<ConversationRow>((from, to) => supabase.from("conversations")
        .select("id, title, updated_at, assistant_id").eq("assistant_id", ownerProfile.assistant_id).is("user_id", null)
        .eq("is_test", false)
        .order("updated_at", { ascending: false }).range(from, to))
      : Promise.resolve({ data: [] as ConversationRow[], error: null }),
    fetchAllPages<HandoffRow>((from, to) => supabase.from("handoff_requests")
      .select("id, conversation_id, customer_name, customer_email, reason, latest_message, transcript, status, created_at, updated_at, archived_at")
      .eq("owner_user_id", user.id).order("updated_at", { ascending: false }).range(from, to)),
  ]);
  if (ownedConversationResult.error || visitorConversationResult.error || handoffResult.error) {
    console.error("[history] list-failed");
    return NextResponse.json({ error: "Unable to load conversation history." }, { status: 500 });
  }

  const conversations = [...(ownedConversationResult.data ?? []), ...(visitorConversationResult.data ?? [])];
  const handoffs = handoffResult.data ?? [];
  const conversationIds = conversations.map((item) => item.id);
  const handoffIds = handoffs.map((item) => item.id);
  const [messageResult, handoffMessageResult] = await Promise.all([
    fetchRowsByIds<MessageRow>(conversationIds, (ids, from, to) => supabase.from("messages")
      .select("conversation_id, role, content, created_at, sources").in("conversation_id", ids)
      .order("created_at", { ascending: true }).range(from, to)),
    fetchRowsByIds<HandoffMessageRow>(handoffIds, (ids, from, to) => supabase.from("handoff_messages")
      .select("id, handoff_id, role, content, created_at").in("handoff_id", ids)
      .order("created_at", { ascending: true }).range(from, to)),
  ]);
  if (messageResult.error || handoffMessageResult.error) {
    console.error("[history] messages-failed");
    return NextResponse.json({ error: "Unable to load conversation history." }, { status: 500 });
  }

  const messages = messageResult.data ?? [];
  const handoffMessages = handoffMessageResult.data ?? [];
  const messagesByConversation = new Map<string, MessageRow[]>();
  for (const message of messages) {
    const list = messagesByConversation.get(message.conversation_id) ?? [];
    list.push(message);
    messagesByConversation.set(message.conversation_id, list);
  }
  const handoffMessagesById = new Map<string, HandoffMessageRow[]>();
  for (const message of handoffMessages) {
    const list = handoffMessagesById.get(message.handoff_id) ?? [];
    list.push(message);
    handoffMessagesById.set(message.handoff_id, list);
  }

  const conversationEntries: HistoryEntry[] = conversations.map((conversation) => {
    const rows = messagesByConversation.get(conversation.id) ?? [];
    const first = rows[0]?.created_at || conversation.updated_at;
    const last = rows.at(-1)?.created_at || conversation.updated_at;
    const firstUserMessage = rows.find((item) => item.role === "user")?.content;
    const title = conversation.title?.trim() || snippet(firstUserMessage || "AI conversation", 80);
    const preview = snippet(rows.at(-1)?.content || firstUserMessage || "No messages recorded.");
    return {
      id: conversation.id, kind: "ai", title, customer: conversation.assistant_id ? "Website visitor" : "Assistant chat", status: "all",
      firstActivityAt: first, lastActivityAt: last, preview, archived: false,
      searchText: `${title} ${preview} ${rows.map((row) => `${row.content} ${JSON.stringify(row.sources ?? [])}`).join(" ")}`,
    };
  });

  const handoffEntries = handoffs.map((handoff) => {
    const transcript = Array.isArray(handoff.transcript)
      ? handoff.transcript.filter((item): item is { role: string; content: string } =>
        Boolean(item && typeof item === "object" && typeof (item as { content?: unknown }).content === "string"),
      )
      : [];
    const persisted = handoffMessagesById.get(handoff.id) ?? [];
    const orderedContent = [
      ...transcript.map((item) => item.content),
      ...persisted.map((item) => item.content),
    ];
    const latestPersisted = persisted.at(-1);
    const lastActivityAt = latestPersisted?.created_at || handoff.updated_at;
    const firstActivityAt = handoff.created_at;
    const title = snippet(handoff.latest_message || transcript.find((item) => item.role === "user")?.content || handoff.reason, 80);
    const preview = snippet(latestPersisted?.content || handoff.latest_message || title);
    const containsAiAndHuman = transcript.some((item) => item.role === "assistant") &&
      persisted.some((item) => item.role === "human");
    const entry: HistoryEntry & { conversationId?: string } = {
      id: handoff.id, kind: containsAiAndHuman ? "mixed" : "handoff", handoffId: handoff.id, title,
      customer: handoff.customer_name || handoff.customer_email || "Website visitor",
      status: handoff.status, firstActivityAt, lastActivityAt, preview,
      archived: Boolean(handoff.archived_at),
      searchText: `${title} ${preview} ${handoff.customer_name ?? ""} ${handoff.customer_email ?? ""} ${handoff.reason} ${orderedContent.join(" ")}`,
      conversationId: handoff.conversation_id ?? undefined,
    };
    return entry;
  });

  const entries = filterHistoryEntries(mergeLinkedHandoffs(conversationEntries, handoffEntries), filters);
  const result = paginateHistoryEntries(entries, page, pageSize);
  return NextResponse.json({
    ...result,
    items: result.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      handoffId: item.handoffId,
      title: item.title,
      customer: item.customer,
      status: item.status,
      firstActivityAt: item.firstActivityAt,
      lastActivityAt: item.lastActivityAt,
      preview: item.preview,
      archived: item.archived,
    })),
  });
}
