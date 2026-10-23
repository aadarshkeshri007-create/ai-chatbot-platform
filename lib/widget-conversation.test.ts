import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createWidgetSessionToken, hashWidgetSessionToken, isValidPublicChatTurnInput, safeWidgetSources } from "./widget-conversation.ts";

const validTurn = {
  assistantId: "73df06ca-95c0-41e1-b160-d569f3864291",
  sessionHash: "a".repeat(64),
  requestId: "7b68e6f1-f634-41b5-9d44-d2f067b126ef",
  visitorMessage: "Where is my order?",
  assistantMessage: "Your order is on its way.",
  sources: [{ label: "shipping.pdf", document_id: "document-1", chunk_id: "chunk-2", chunk_index: 1 }],
  title: "Where is my order?",
};

test("visitor session tokens are opaque and hashed without preserving the token", () => {
  const token = createWidgetSessionToken();
  assert.match(token, /^[A-Za-z0-9_-]{40,100}$/);
  assert.equal(hashWidgetSessionToken(token), hashWidgetSessionToken(token));
  assert.notEqual(hashWidgetSessionToken(token), hashWidgetSessionToken(createWidgetSessionToken()));
  assert.throws(() => hashWidgetSessionToken("short"));
});

test("citation persistence keeps retrieval identity and drops unsafe/non-reference values", () => {
  assert.deepEqual(safeWidgetSources([
    { label: "guide.pdf", document_id: "doc-1", chunk_id: "chunk-1", chunk_index: 2, url: "https://private" },
    { label: "  " }, null,
  ]), [{ label: "guide.pdf", document_id: "doc-1", chunk_id: "chunk-1", chunk_index: 2 }]);
});

test("public chat turn validation accepts route-shaped values and rejects null IDs or malformed sources", () => {
  assert.equal(isValidPublicChatTurnInput(validTurn), true);
  assert.equal(isValidPublicChatTurnInput({ ...validTurn, assistantId: null as unknown as string }), false);
  assert.equal(isValidPublicChatTurnInput({ ...validTurn, requestId: null as unknown as string }), false);
  assert.equal(isValidPublicChatTurnInput({ ...validTurn, sessionHash: null as unknown as string }), false);
  assert.equal(isValidPublicChatTurnInput({ ...validTurn, sources: null }), false);
  assert.equal(isValidPublicChatTurnInput({ ...validTurn, sources: { label: "shipping.pdf" } }), false);
  assert.equal(isValidPublicChatTurnInput({ ...validTurn, sources: [{ label: "" }] }), false);
});

test("SQL persistence contract is session-scoped, atomic, and request-idempotent", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20261019150000_persist_widget_conversations.sql", import.meta.url), "utf8");
  assert.match(migration, /conversations_visitor_session_unique[\s\S]*\(assistant_id, visitor_session_hash\)/i);
  assert.match(migration, /pg_advisory_xact_lock[\s\S]*requested_assistant_id::text \|\| ':' \|\| requested_session_hash/i);
  assert.match(migration, /client_message_id = requested_message_id and role = 'user'/i);
  assert.match(migration, /client_message_id = requested_message_id and role = 'assistant'/i);
  assert.match(migration, /assistant_sources jsonb/i);
  assert.match(migration, /requested_message_id is null/i);
  assert.match(migration, /assistant_sources is null/i);
  assert.match(migration, /jsonb_typeof\(assistant_sources\) is distinct from 'array'/i);
  assert.match(migration, /set search_path = pg_catalog, pg_temp/i);
  assert.match(migration, /Expected defaults for conversation and message timestamps/i);
  assert.match(migration, /Expected UUID defaults for conversations\.id and messages\.id/i);
  assert.match(migration, /from public, anon, authenticated/i);
  assert.match(migration, /to service_role/i);
  assert.match(migration, /messages_assistant_owner_select/i);
});
