import { isOwnedTestConversation, type TestConversation } from "./testing-playground.ts";

export type TestConversationSummary = TestConversation & {
  title: string | null;
  updated_at: string;
};

export function normalizeOwnedTestConversations(
  value: unknown,
  userId: string,
  assistantId: string,
): Array<{ id: string; title: string; updated_at: string }> | null {
  if (!Array.isArray(value)) return null;
  const rows: Array<{ id: string; title: string; updated_at: string }> = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Partial<TestConversationSummary>;
    if (typeof row.id !== "string" || typeof row.updated_at !== "string" ||
      !(row.title === null || typeof row.title === "string") || typeof row.is_test !== "boolean") return null;
    if (!isOwnedTestConversation(row as TestConversation, userId, assistantId)) continue;
    rows.push({ id: row.id, title: row.title?.trim() || "Untitled conversation", updated_at: row.updated_at });
  }

  return rows;
}

export function getConversationLoadErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (error?.code === "42703" || error?.code === "PGRST204") {
    if (error.message?.includes("is_test")) {
      return "The test conversation schema is unavailable. Apply migration 20261021100000_assistant_testing_feedback.sql, then retry.";
    }
    return "The conversation schema is unavailable. Check that the required database migrations are applied, then retry.";
  }
  return "We couldn’t load saved test conversations. Check your connection and retry.";
}

export const UNAUTHENTICATED_CONVERSATION_MESSAGE = "Your session has expired. Sign in again to view saved test conversations.";
