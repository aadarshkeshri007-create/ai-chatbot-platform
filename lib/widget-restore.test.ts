import assert from "node:assert/strict";
import test from "node:test";
import { hashWidgetSessionToken } from "./widget-conversation.ts";
import {
  WIDGET_RESTORE_MESSAGE_LIMIT,
  expireStaleVisitorConversation,
  pendingEscalationRequestId,
  restoreWidgetConversation,
  type StoredWidgetMessage,
  type WidgetRestoreStore,
} from "./widget-restore.ts";

/**
 * In-memory stand-in for the Supabase-backed store. It models the database
 * rules the feature depends on (assistant scoping, hashed-session lookup,
 * a unique (assistant, session) slot, conditional detach). It proves the
 * application logic only; it is NOT evidence about a live Supabase project.
 */
class FakeDb implements WidgetRestoreStore {
  conversations: Array<{ id: string; assistant_id: string; hash: string | null; updated_at: Date }> = [];
  messages = new Map<string, StoredWidgetMessage[]>();
  failOn: "detach" | "find" | "list" | null = null;
  detachCalls = 0;
  private seq = 0;

  createConversation(assistantId: string, hash: string, updatedAt: Date) {
    if (this.conversations.some((c) => c.assistant_id === assistantId && c.hash === hash)) {
      throw new Error("unique violation: conversations_visitor_session_unique");
    }
    const id = `c${++this.seq}`;
    this.conversations.push({ id, assistant_id: assistantId, hash, updated_at: updatedAt });
    this.messages.set(id, []);
    return id;
  }
  addTurn(conversationId: string, requestId: string, user: string, assistant: string, at: Date) {
    const rows = this.messages.get(conversationId)!;
    rows.push({ role: "user", content: user, created_at: at.toISOString(), sources: [], client_message_id: requestId });
    rows.push({ role: "assistant", content: assistant, created_at: new Date(at.getTime() + 1).toISOString(), sources: [{ label: "Doc" }], client_message_id: requestId });
    this.conversations.find((c) => c.id === conversationId)!.updated_at = at;
  }
  async detachStaleConversation(assistantId: string, sessionHash: string, cutoff: Date) {
    this.detachCalls++;
    if (this.failOn === "detach") throw new Error("db down");
    const row = this.conversations.find((c) => c.assistant_id === assistantId && c.hash === sessionHash && c.updated_at < cutoff);
    if (!row) return false;
    row.hash = null;
    return true;
  }
  async findConversation(assistantId: string, sessionHash: string) {
    if (this.failOn === "find") throw new Error("db down");
    const row = this.conversations.find((c) => c.assistant_id === assistantId && c.hash === sessionHash);
    return row ? { id: row.id } : null;
  }
  async listRecentMessages(conversationId: string, limit: number) {
    if (this.failOn === "list") throw new Error("db down");
    return [...(this.messages.get(conversationId) ?? [])]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
}

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const tokenFor = (n: string) => `${n}${"a".repeat(45)}`;
const hashA = hashWidgetSessionToken(tokenFor("visitorOne"));
const hashB = hashWidgetSessionToken(tokenFor("visitorTwo"));
const NOW = new Date("2026-11-20T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const REQ1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REQ2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ctx = (assistantId: string, sessionHash: string) => ({ assistantId, sessionHash, retentionDays: 30, now: NOW });

test("a visitor with no conversation gets an empty, non-error result", async () => {
  const db = new FakeDb();
  assert.deepEqual(await restoreWidgetConversation(db, ctx(TENANT_A, hashA)), { status: "empty" });
});

test("user and assistant messages reload in chronological order with request ids and safe sources", async () => {
  const db = new FakeDb();
  const id = db.createConversation(TENANT_A, hashA, daysAgo(1));
  db.addTurn(id, REQ1, "first question", "first answer", daysAgo(1));
  db.addTurn(id, REQ2, "second question", "second answer", new Date(daysAgo(1).getTime() + 5000));
  db.messages.get(id)!.push({ role: "system", content: "internal", created_at: daysAgo(1).toISOString() });
  const result = await restoreWidgetConversation(db, ctx(TENANT_A, hashA));
  assert.equal(result.status, "restored");
  if (result.status !== "restored") return;
  assert.equal(result.conversationId, id);
  assert.deepEqual(result.messages.map((m) => [m.role, m.content]), [
    ["user", "first question"], ["assistant", "first answer"],
    ["user", "second question"], ["assistant", "second answer"],
  ]);
  assert.deepEqual(result.messages.map((m) => m.request_id), [REQ1, REQ1, REQ2, REQ2]);
  assert.deepEqual(result.messages[1].sources, [{ label: "Doc" }]);
});

test("only the most recent messages are restored, still in order", async () => {
  const db = new FakeDb();
  const id = db.createConversation(TENANT_A, hashA, daysAgo(1));
  const base = daysAgo(1).getTime();
  for (let i = 0; i < 70; i++) {
    db.addTurn(id, `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, `q${i}`, `a${i}`, new Date(base + i * 1000));
  }
  const result = await restoreWidgetConversation(db, ctx(TENANT_A, hashA));
  assert.equal(result.status, "restored");
  if (result.status !== "restored") return;
  assert.equal(result.messages.length, WIDGET_RESTORE_MESSAGE_LIMIT);
  assert.equal(result.messages.at(-1)?.content, "a69");
  assert.equal(result.messages[0].content, "q20");
});

test("refresh and browser restart resume the same conversation using the same stored token", async () => {
  const db = new FakeDb();
  const id = db.createConversation(TENANT_A, hashA, daysAgo(2));
  db.addTurn(id, REQ1, "hello", "hi there", daysAgo(2));
  const first = await restoreWidgetConversation(db, ctx(TENANT_A, hashA));
  const second = await restoreWidgetConversation(db, ctx(TENANT_A, hashWidgetSessionToken(tokenFor("visitorOne"))));
  assert.deepEqual(second, first);
  assert.equal(db.conversations[0].updated_at.getTime(), daysAgo(2).getTime(), "reading must not extend retention");
});

test("two tenants with the same visitor token never see each other's conversation", async () => {
  const db = new FakeDb();
  const a = db.createConversation(TENANT_A, hashA, daysAgo(1));
  db.addTurn(a, REQ1, "tenant A secret", "answer A", daysAgo(1));
  const b = db.createConversation(TENANT_B, hashA, daysAgo(1));
  db.addTurn(b, REQ2, "tenant B secret", "answer B", daysAgo(1));
  const restoredA = await restoreWidgetConversation(db, ctx(TENANT_A, hashA));
  const restoredB = await restoreWidgetConversation(db, ctx(TENANT_B, hashA));
  assert.ok(restoredA.status === "restored" && restoredB.status === "restored");
  if (restoredA.status !== "restored" || restoredB.status !== "restored") return;
  assert.equal(restoredA.conversationId, a);
  assert.equal(restoredB.conversationId, b);
  assert.ok(restoredA.messages.every((m) => !m.content.includes("B")));
  assert.ok(restoredB.messages.every((m) => !m.content.includes("A secret")));
  assert.deepEqual(await restoreWidgetConversation(db, ctx("33333333-3333-4333-8333-333333333333", hashA)), { status: "empty" });
});

test("a guessed or invalid resume credential is indistinguishable from a new visitor", async () => {
  const db = new FakeDb();
  const id = db.createConversation(TENANT_A, hashA, daysAgo(1));
  db.addTurn(id, REQ1, "private", "reply", daysAgo(1));
  const attacker = await restoreWidgetConversation(db, ctx(TENANT_A, hashB));
  assert.deepEqual(attacker, await restoreWidgetConversation(new FakeDb(), ctx(TENANT_A, hashB)));
  assert.deepEqual(attacker, { status: "empty" });
  // A conversation id is not a credential: restore has no conversation-id input at all.
  assert.equal(restoreWidgetConversation.length, 2);
});

test("an expired conversation cannot be resumed and its history is retained, not deleted", async () => {
  const db = new FakeDb();
  const id = db.createConversation(TENANT_A, hashA, daysAgo(31));
  db.addTurn(id, REQ1, "old question", "old answer", daysAgo(31));
  assert.deepEqual(await restoreWidgetConversation(db, ctx(TENANT_A, hashA)), { status: "expired" });
  assert.deepEqual(await restoreWidgetConversation(db, ctx(TENANT_A, hashA)), { status: "empty" }, "not resumable on later attempts");
  assert.equal(db.messages.get(id)!.length, 2, "history retained for the owner");
  assert.equal(db.conversations[0].hash, null);
});

test("a conversation active within the window is not expired, including at 29 days", async () => {
  const db = new FakeDb();
  const id = db.createConversation(TENANT_A, hashA, daysAgo(29));
  db.addTurn(id, REQ1, "q", "a", daysAgo(29));
  assert.equal((await restoreWidgetConversation(db, ctx(TENANT_A, hashA))).status, "restored");
});

test("retention is configurable per call", async () => {
  const db = new FakeDb();
  const id = db.createConversation(TENANT_A, hashA, daysAgo(10));
  db.addTurn(id, REQ1, "q", "a", daysAgo(10));
  assert.equal((await restoreWidgetConversation(db, { ...ctx(TENANT_A, hashA), retentionDays: 7 })).status, "expired");
});

test("after expiry the same browser token starts a new conversation without touching other history", async () => {
  const db = new FakeDb();
  const stale = db.createConversation(TENANT_A, hashA, daysAgo(40));
  db.addTurn(stale, REQ1, "stale", "stale answer", daysAgo(40));
  const unrelated = db.createConversation(TENANT_A, hashB, daysAgo(40));
  db.addTurn(unrelated, REQ2, "someone else", "reply", daysAgo(40));
  const otherTenant = db.createConversation(TENANT_B, hashA, daysAgo(40));

  // The chat route detaches the stale session before persisting a new turn.
  assert.equal(await expireStaleVisitorConversation(db, ctx(TENANT_A, hashA)), true);
  assert.doesNotThrow(() => db.createConversation(TENANT_A, hashA, NOW), "the unique slot is free for a fresh conversation");
  assert.equal(db.conversations.find((c) => c.id === unrelated)!.hash, hashB, "other visitors are untouched");
  assert.equal(db.conversations.find((c) => c.id === otherTenant)!.hash, hashA, "other tenants are untouched");
  assert.equal(db.messages.get(stale)!.length, 2);
  assert.equal(db.messages.get(unrelated)!.length, 2);
});

test("starting a new conversation (rotated token) leaves the previous conversation intact", async () => {
  const db = new FakeDb();
  const id = db.createConversation(TENANT_A, hashA, daysAgo(1));
  db.addTurn(id, REQ1, "keep me", "kept", daysAgo(1));
  assert.deepEqual(await restoreWidgetConversation(db, ctx(TENANT_A, hashB)), { status: "empty" });
  assert.equal(db.conversations.length, 1);
  assert.equal(db.messages.get(id)!.length, 2);
  assert.equal(db.conversations[0].hash, hashA, "old conversation is not detached or deleted by rotation");
});

test("repeated expiry checks are idempotent and safe to retry", async () => {
  const db = new FakeDb();
  db.createConversation(TENANT_A, hashA, daysAgo(60));
  assert.equal(await expireStaleVisitorConversation(db, ctx(TENANT_A, hashA)), true);
  assert.equal(await expireStaleVisitorConversation(db, ctx(TENANT_A, hashA)), false);
});

test("database failures during restoration surface as errors, never as an empty conversation", async () => {
  for (const failOn of ["detach", "find", "list"] as const) {
    const db = new FakeDb();
    const id = db.createConversation(TENANT_A, hashA, daysAgo(1));
    db.addTurn(id, REQ1, "q", "a", daysAgo(1));
    db.failOn = failOn;
    await assert.rejects(() => restoreWidgetConversation(db, ctx(TENANT_A, hashA)), /db down/, failOn);
    assert.equal(db.conversations[0].hash, hashA, "a failed restore must not detach or modify the stored reference");
    db.failOn = null;
    assert.equal((await restoreWidgetConversation(db, ctx(TENANT_A, hashA))).status, "restored", "retry succeeds");
  }
});

test("an unanswered abstention re-offers human follow-up only when handoff is enabled", () => {
  const fallback = "I don't have that information.";
  const messages = [
    { role: "user" as const, content: "q", created_at: "t1", sources: [], request_id: REQ1 },
    { role: "assistant" as const, content: fallback, created_at: "t2", sources: [], request_id: REQ1 },
  ];
  assert.equal(pendingEscalationRequestId(messages, fallback, true), REQ1);
  assert.equal(pendingEscalationRequestId(messages, fallback, false), null);
  assert.equal(pendingEscalationRequestId(messages, "different", true), null);
  assert.equal(pendingEscalationRequestId([...messages, { role: "user", content: "next", created_at: "t3", sources: [] }], fallback, true), null);
  assert.equal(pendingEscalationRequestId([], fallback, true), null);
});
