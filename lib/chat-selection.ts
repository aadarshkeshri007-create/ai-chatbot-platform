export const CHAT_CONVERSATION_QUERY_PARAM = "conversation";

export type InitialChatSelection =
  | { type: "wait" }
  | { type: "new" }
  | { type: "restore"; conversationId: string }
  | { type: "unavailable" };

export function readChatConversationId(search: string): string | null {
  const value = new URLSearchParams(search).get(CHAT_CONVERSATION_QUERY_PARAM)?.trim();
  return value || null;
}

export function resolveInitialChatSelection(
  requestedConversationId: string | null | undefined,
  conversationIds: readonly string[],
  conversationListLoading: boolean,
  conversationListError: boolean,
): InitialChatSelection {
  if (requestedConversationId === undefined || conversationListLoading || conversationListError) {
    return { type: "wait" };
  }

  if (!requestedConversationId) return { type: "new" };

  return conversationIds.includes(requestedConversationId)
    ? { type: "restore", conversationId: requestedConversationId }
    : { type: "unavailable" };
}

export function getChatConversationUrl(currentUrl: string, conversationId: string | null): string {
  const url = new URL(currentUrl);
  if (conversationId) {
    url.searchParams.set(CHAT_CONVERSATION_QUERY_PARAM, conversationId);
  } else {
    url.searchParams.delete(CHAT_CONVERSATION_QUERY_PARAM);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
