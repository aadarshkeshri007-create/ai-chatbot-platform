import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { getConversationLoadErrorMessage, normalizeOwnedTestConversations, UNAUTHENTICATED_CONVERSATION_MESSAGE } from "./conversation-load.ts";

const owned = { id: "c1", title: "Support test", updated_at: "2026-10-21T10:00:00Z", user_id: "u1", assistant_id: "a1", is_test: true };

test("normalizes an owned conversation list and accepts a successful empty list", () => {
  assert.deepEqual(normalizeOwnedTestConversations([owned], "u1", "a1"), [
    { id: "c1", title: "Support test", updated_at: "2026-10-21T10:00:00Z" },
  ]);
  assert.deepEqual(normalizeOwnedTestConversations([], "u1", "a1"), []);
});

test("filters visitor, other-user, other-assistant, and non-test conversations", () => {
  assert.deepEqual(normalizeOwnedTestConversations([
    owned,
    { ...owned, id: "visitor", user_id: null, is_test: false },
    { ...owned, id: "other-user", user_id: "u2" },
    { ...owned, id: "other-assistant", assistant_id: "a2" },
    { ...owned, id: "not-test", is_test: false },
  ], "u1", "a1"), [{ id: "c1", title: "Support test", updated_at: "2026-10-21T10:00:00Z" }]);
});

test("rejects malformed API/query response shapes instead of treating them as empty", () => {
  assert.equal(normalizeOwnedTestConversations(null, "u1", "a1"), null);
  assert.equal(normalizeOwnedTestConversations([{ ...owned, updated_at: 42 }], "u1", "a1"), null);
});

test("uses safe actionable messages for unauthenticated and database failures", () => {
  assert.match(UNAUTHENTICATED_CONVERSATION_MESSAGE, /session has expired/i);
  assert.match(getConversationLoadErrorMessage({ code: "42703", message: "column conversations.is_test does not exist" }), /20261021100000_assistant_testing_feedback\.sql/);
  const generic = getConversationLoadErrorMessage({ code: "42501", message: "private conversation text and token" });
  assert.match(generic, /retry/i);
  assert.doesNotMatch(generic, /private conversation|token/i);
});

test("Chat loads only authenticated owner and assistant test rows, and exposes a retry path", async () => {
  const page = await readFile(new URL("../app/(app)/chat/page.tsx", import.meta.url), "utf8");
  assert.match(page, /supabase\.auth\.getUser\(\)/);
  assert.match(page, /\.eq\("user_id", user\.id\)/);
  assert.match(page, /\.eq\("assistant_id", profile\.assistant_id\)/);
  assert.match(page, /\.eq\("is_test", true\)/);
  assert.match(page, /logSupabaseError\("Chat conversation list error:/);
  assert.match(page, /onClick=\{\(\) => void loadConversations\(\)\}/);
});
