import { classifyChatFailure } from "./chat-errors.ts";

export type RetrievalQueryResult = {
  query: string;
  outcome: "original_query" | "rewritten" | "original_after_timeout";
};

/**
 * Rewriting only resolves references using prior turns. With no prior turns,
 * the current question is already the safest and most precise retrieval query.
 * On a Gemini deadline, it is safe to search with that original question.
 */
export async function resolveRetrievalQuery(
  originalQuery: string,
  hasConversationHistory: boolean,
  rewrite: () => Promise<string | undefined>,
  isAborted: () => boolean = () => false,
): Promise<RetrievalQueryResult> {
  if (!hasConversationHistory) {
    return { query: originalQuery, outcome: "original_query" };
  }

  try {
    const rewritten = (await rewrite())?.trim();
    return rewritten
      ? { query: rewritten, outcome: "rewritten" }
      : { query: originalQuery, outcome: "original_query" };
  } catch (error) {
    if (isAborted() || classifyChatFailure(error).category !== "deadline_exceeded") throw error;
    return { query: originalQuery, outcome: "original_after_timeout" };
  }
}
