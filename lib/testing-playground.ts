export type TestConversation = {
  id: string;
  user_id: string | null;
  assistant_id: string | null;
  is_test: boolean;
};

export function isOwnedTestConversation(
  conversation: TestConversation | null | undefined,
  userId: string,
  assistantId: string,
): boolean {
  return Boolean(conversation && conversation.user_id === userId &&
    conversation.assistant_id === assistantId && conversation.is_test === true);
}

type TestMessage = { id: string; conversation_id: string; role: string; created_at: string; sources?: unknown };

export function isValidFeedbackPair(conversationId: string, question: TestMessage | undefined, answer: TestMessage | undefined): boolean {
  return Boolean(question && answer && question.conversation_id === conversationId && answer.conversation_id === conversationId &&
    question.role === "user" && answer.role === "assistant" && Date.parse(question.created_at) <= Date.parse(answer.created_at));
}

export function getFeedbackSources(answerSources: unknown): Array<{ label: string; document_id?: string; chunk_id?: string; chunk_index?: number }> {
  if (!Array.isArray(answerSources)) return [];
  return answerSources.slice(0, 10).flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const source = value as Record<string, unknown>;
    if (typeof source.label !== "string" || !source.label.trim()) return [];
    return [{
      label: source.label.trim().slice(0, 200),
      ...(typeof source.document_id === "string" && source.document_id.length <= 200 ? { document_id: source.document_id } : {}),
      ...(typeof source.chunk_id === "string" && source.chunk_id.length <= 200 ? { chunk_id: source.chunk_id } : {}),
      ...(Number.isInteger(source.chunk_index) && (source.chunk_index as number) >= 0 ? { chunk_index: source.chunk_index as number } : {}),
    }];
  });
}

export function getRetrievalState(sources: unknown): "supported" | "insufficient" {
  return Array.isArray(sources) && sources.length > 0 ? "supported" : "insufficient";
}

export const FEEDBACK_TYPES = ["helpful", "not_helpful", "report_issue"] as const;
export const FEEDBACK_CATEGORIES = ["missing_knowledge", "incorrect_answer", "irrelevant_sources", "formatting_clarity", "other"] as const;
export type FeedbackType = typeof FEEDBACK_TYPES[number];
export type FeedbackCategory = typeof FEEDBACK_CATEGORIES[number];

export function isFeedbackType(value: unknown): value is FeedbackType {
  return typeof value === "string" && FEEDBACK_TYPES.includes(value as FeedbackType);
}

export function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return typeof value === "string" && FEEDBACK_CATEGORIES.includes(value as FeedbackCategory);
}

export const FAQ_DRAFT_STATUSES = ["pending_review", "approved", "processing", "processed", "failed"] as const;
export type FaqDraftStatus = typeof FAQ_DRAFT_STATUSES[number];

export function isFaqDraftEditable(status: unknown): boolean {
  return status === "pending_review" || status === "failed";
}

export function isFaqDraftProcessable(status: unknown, answer: string): boolean {
  return isFaqDraftEditable(status) && answer.trim().length >= 10 && answer.trim().length <= 8000;
}

export function getFaqProcessingResult(succeeded: boolean, safeError: string) {
  return succeeded
    ? { status: "processed" as const, processing_error: null }
    : { status: "failed" as const, processing_error: safeError.slice(0, 500) };
}

