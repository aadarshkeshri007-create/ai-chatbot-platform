import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { getRetrievalState, isOwnedTestConversation, isFaqDraftEditable, isFaqDraftProcessable, isFeedbackCategory, isFeedbackType, getFeedbackSources, isValidFeedbackPair, getFaqProcessingResult } from "./testing-playground.ts";

const conversation = { id: "c1", user_id: "u1", assistant_id: "a1", is_test: true };

test("test chats are isolated from visitor and other-owner conversations", () => {
  assert.equal(isOwnedTestConversation(conversation, "u1", "a1"), true);
  assert.equal(isOwnedTestConversation({ ...conversation, is_test: false }, "u1", "a1"), false);
  assert.equal(isOwnedTestConversation(conversation, "u2", "a1"), false);
  assert.equal(isOwnedTestConversation(conversation, "u1", "a2"), false);
});

test("retrieval state reflects actual cited sources without inventing scores", () => {
  assert.equal(getRetrievalState([{ label: "returns.pdf", chunk_index: 2 }]), "supported");
  assert.equal(getRetrievalState([]), "insufficient");
  assert.equal(getRetrievalState(null), "insufficient");
});

test("feedback categories and FAQ draft states are constrained", () => {
  assert.equal(isFeedbackType("report_issue"), true);
  assert.equal(isFeedbackType("excellent"), false);
  assert.equal(isFeedbackCategory("missing_knowledge"), true);
  assert.equal(isFeedbackCategory("billing"), false);
  assert.equal(isFaqDraftEditable("failed"), true);
  assert.equal(isFaqDraftEditable("processed"), false);
  assert.equal(isFaqDraftProcessable("pending_review", "A reviewed answer that has enough detail."), true);
  assert.equal(isFaqDraftProcessable("pending_review", ""), false);
  assert.deepEqual(getFaqProcessingResult(true, "ignored"), { status: "processed", processing_error: null });
  assert.deepEqual(getFaqProcessingResult(false, "Safe ingestion failure"), { status: "failed", processing_error: "Safe ingestion failure" });
});

test("feedback is bound to the exact ordered messages and their actual saved source references", () => {
  const question = { id: "u1", conversation_id: "c1", role: "user", created_at: "2026-10-20T10:00:00Z" };
  const answer = { id: "a1", conversation_id: "c1", role: "assistant", created_at: "2026-10-20T10:00:01Z" };
  assert.equal(isValidFeedbackPair("c1", question, answer), true);
  assert.equal(isValidFeedbackPair("c2", question, answer), false);
  assert.equal(isValidFeedbackPair("c1", answer, question), false);
  assert.deepEqual(getFeedbackSources([
    { label: "returns.pdf", document_id: "doc1", chunk_id: "chunk3", chunk_index: 2 },
    { label: "", chunk_id: "invalid" }, { label: "FAQ", private_url: "https://private.invalid" },
  ]), [
    { label: "returns.pdf", document_id: "doc1", chunk_id: "chunk3", chunk_index: 2 },
    { label: "FAQ" },
  ]);
});

test("the additive schema keeps test records separate and feedback owner scoped and idempotent", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20261021100000_assistant_testing_feedback.sql", import.meta.url), "utf8");
  assert.match(migration, /add column if not exists is_test boolean not null default false/i);
  assert.match(migration, /update public\.conversations set is_test = true where user_id is not null/i);
  assert.match(migration, /assistant_message_id uuid not null unique references public\.messages/i);
  assert.match(migration, /unique \(owner_user_id, request_id\)/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /owner_user_id = auth\.uid\(\)/i);
  assert.match(migration, /c\.is_test/i);
});

test("chat, history, feedback, and FAQ processing use the test and owner boundaries", async () => {
  const [chatRoute, historyRoute, feedbackRoute, draftRoute, processingRoute, checklist] = await Promise.all([
    readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/history/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/chat/feedback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/chat/faq-drafts/[draftId]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/documents/process/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/OnboardingChecklist.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(chatRoute, /assistant_id: profile\.assistant_id, is_test: true/);
  assert.match(chatRoute, /\.eq\("is_test", true\)/);
  assert.match(historyRoute, /\.eq\("is_test", false\)/);
  assert.match(feedbackRoute, /\.eq\("user_id", user\.id\).*\.eq\("assistant_id", profile\.assistant_id\).*\.eq\("is_test", true\)/);
  assert.match(feedbackRoute, /isValidFeedbackPair\(conversation\.id, question, answer\)/);
  assert.match(draftRoute, /\.eq\("owner_user_id", user\.id\).*\.eq\("assistant_id", profile\.assistant_id\)/);
  assert.match(processingRoute, /document\.file_type === "text\/plain"/);
  assert.match(processingRoute, /getFaqProcessingResult\(false/);
  assert.match(checklist, /\.eq\("is_test", true\)/);
});
