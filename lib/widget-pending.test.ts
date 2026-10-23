import assert from "node:assert/strict";
import test from "node:test";
import {
  WIDGET_PENDING_TTL_MS,
  classifyPendingQuestion,
  clearPendingQuestion,
  pendingQuestionKey,
  readPendingQuestion,
  savePendingQuestion,
} from "./widget-pending.ts";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const REQ = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = 1_800_000_000_000;

test("a pending question round-trips and is scoped by assistant", () => {
  const s = new MemoryStorage();
  savePendingQuestion(A, { requestId: REQ, message: "Where is my order?" }, s, NOW);
  assert.deepEqual(readPendingQuestion(A, s, NOW + 1000), { requestId: REQ, message: "Where is my order?", savedAt: NOW });
  assert.equal(readPendingQuestion(B, s, NOW + 1000), null, "another tenant must not see it");
});

test("pending questions expire and are removed from storage", () => {
  const s = new MemoryStorage();
  savePendingQuestion(A, { requestId: REQ, message: "hello" }, s, NOW);
  assert.equal(readPendingQuestion(A, s, NOW + WIDGET_PENDING_TTL_MS + 1), null);
  assert.equal(s.getItem(pendingQuestionKey(A)), null);
});

test("malformed or tampered entries are rejected and cleared", () => {
  for (const raw of [
    "not json",
    JSON.stringify({ requestId: "nope", message: "x", savedAt: NOW }),
    JSON.stringify({ requestId: REQ, message: "   ", savedAt: NOW }),
    JSON.stringify({ requestId: REQ, message: "x".repeat(8001), savedAt: NOW }),
    JSON.stringify({ requestId: REQ, message: "x", savedAt: "soon" }),
    JSON.stringify({ requestId: REQ, message: "x", savedAt: NOW + 10 * 60_000 }),
  ]) {
    const s = new MemoryStorage();
    s.setItem(pendingQuestionKey(A), raw);
    assert.equal(readPendingQuestion(A, s, NOW), null, raw.slice(0, 40));
    assert.equal(s.getItem(pendingQuestionKey(A)), null);
  }
});

test("clearing only removes the targeted assistant's entry", () => {
  const s = new MemoryStorage();
  savePendingQuestion(A, { requestId: REQ, message: "a" }, s, NOW);
  savePendingQuestion(B, { requestId: REQ, message: "b" }, s, NOW);
  clearPendingQuestion(A, s);
  assert.equal(readPendingQuestion(A, s, NOW), null);
  assert.equal(readPendingQuestion(B, s, NOW)?.message, "b");
});

test("storage failures never throw", () => {
  const broken = {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("quota"); },
    removeItem() { throw new Error("denied"); },
  };
  assert.doesNotThrow(() => savePendingQuestion(A, { requestId: REQ, message: "x" }, broken, NOW));
  assert.equal(readPendingQuestion(A, broken, NOW), null);
  assert.doesNotThrow(() => clearPendingQuestion(A, broken));
});

test("a question already answered on the server is not offered for resend, an unsaved one is", () => {
  const pending = { requestId: REQ, message: "q", savedAt: NOW };
  assert.equal(classifyPendingQuestion(pending, [
    { role: "user", request_id: REQ },
    { role: "assistant", request_id: REQ },
  ]), "answered");
  assert.equal(classifyPendingQuestion(pending, []), "resend");
  assert.equal(classifyPendingQuestion(pending, [{ role: "user", request_id: REQ }]), "resend");
  assert.equal(classifyPendingQuestion(pending, [{ role: "assistant", request_id: "other" }]), "resend");
});
