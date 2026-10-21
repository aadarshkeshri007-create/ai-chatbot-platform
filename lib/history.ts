export type HistoryKind = "ai" | "handoff" | "mixed";

export type HistoryEntry = {
  id: string;
  kind: HistoryKind;
  handoffId?: string;
  title: string;
  customer: string;
  status: string;
  firstActivityAt: string;
  lastActivityAt: string;
  preview: string;
  archived: boolean;
  searchText: string;
};

export type HistoryFilters = {
  search?: string;
  from?: string;
  to?: string;
  status?: string;
  kind?: string;
  archived?: "all" | "active" | "archived";
};

export function mergeLinkedHandoffs(
  conversations: HistoryEntry[],
  handoffs: Array<HistoryEntry & { conversationId?: string }>,
): HistoryEntry[] {
  const byConversation = new Map(conversations.map((entry) => [entry.id, entry]));
  const linkedIds = new Set<string>();
  for (const handoff of handoffs) {
    if (!handoff.conversationId) continue;
    const conversation = byConversation.get(handoff.conversationId);
    if (!conversation) continue;
    linkedIds.add(handoff.id);
    conversation.kind = "mixed";
    conversation.handoffId = handoff.id;
    conversation.status = handoff.status;
    conversation.archived = handoff.archived;
    conversation.customer = handoff.customer;
    conversation.lastActivityAt = handoff.lastActivityAt > conversation.lastActivityAt
      ? handoff.lastActivityAt
      : conversation.lastActivityAt;
    conversation.preview = handoff.preview || conversation.preview;
    conversation.searchText += ` ${handoff.searchText}`;
  }
  return [...conversations, ...handoffs.filter((handoff) => !linkedIds.has(handoff.id))]
    .sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt));
}

export function filterHistoryEntries(
  entries: HistoryEntry[],
  filters: HistoryFilters,
): HistoryEntry[] {
  const query = filters.search?.trim().toLocaleLowerCase() ?? "";
  return entries.filter((entry) => {
    if (query && !entry.searchText.toLocaleLowerCase().includes(query)) return false;
    if (filters.from && entry.lastActivityAt.slice(0, 10) < filters.from) return false;
    if (filters.to && entry.lastActivityAt.slice(0, 10) > filters.to) return false;
    if (filters.status && filters.status !== "all" && entry.status !== filters.status) return false;
    if (filters.kind && filters.kind !== "all" && entry.kind !== filters.kind) return false;
    if (filters.archived === "active" && entry.archived) return false;
    if (filters.archived === "archived" && !entry.archived) return false;
    return true;
  });
}

export function paginateHistoryEntries<T>(items: T[], page: number, pageSize: number) {
  const safePage = Number.isSafeInteger(page) && page >= 0 ? page : 0;
  const safePageSize = Number.isSafeInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 25;
  return {
    items: items.slice(safePage * safePageSize, (safePage + 1) * safePageSize),
    page: safePage,
    pageSize: safePageSize,
    total: items.length,
  };
}
