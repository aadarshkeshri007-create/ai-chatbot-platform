import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  clearDismissedEscalations,
  createHandoffAccessToken,
  createHandoffTokenHash,
  dismissEscalationTurn,
  isEscalationTurnDismissed,
  normalizeEmail,
  parseTranscript,
  resolveHandoffLatestMessage,
} from "./handoff.ts";
import { resolveRestoredEscalation } from "./widget-restore.ts";
import { DEFAULT_UNKNOWN_ANSWER_MESSAGE } from "./assistant-behavior.ts";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

test("normalizes and validates customer email", () => {
  assert.equal(normalizeEmail(" Customer@Example.com "), "customer@example.com");
  assert.equal(normalizeEmail("not-an-email"), null);
  assert.equal(normalizeEmail(""), null);
});

test("limits transcript entries and content", () => {
  const transcript = parseTranscript([
    { role: "user", content: "hello" },
    { role: "system", content: "ignored" },
    { role: "assistant", content: "reply" },
  ]);
  assert.equal(transcript.length, 2);
  assert.equal(transcript[1]?.role, "assistant");
});

test("creates a token that verifies through its hash and supports deterministic idempotency seeds", () => {
  const randomAccess = createHandoffAccessToken();
  assert.equal(createHandoffTokenHash(randomAccess.token), randomAccess.hash);
  assert.notEqual(randomAccess.token, randomAccess.hash);

  const seed = "11111111-1111-4111-8111-111111111111:sessionHashA:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const retry1 = createHandoffAccessToken(seed);
  const retry2 = createHandoffAccessToken(seed);
  const differentRequest = createHandoffAccessToken(
    "11111111-1111-4111-8111-111111111111:sessionHashA:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );
  assert.deepEqual(retry1, retry2, "same idempotency seed produces identical token and hash");
  assert.notEqual(retry1.hash, differentRequest.hash, "different request_id produces distinct hash");
  assert.equal(createHandoffTokenHash(retry1.token), retry1.hash);
});

test("resolveHandoffLatestMessage prioritizes explicit latest_message, then last user turn, then reason", () => {
  const transcript = [
    { role: "user" as const, content: "First question" },
    { role: "assistant" as const, content: "First answer" },
    { role: "user" as const, content: "Latest customer question in transcript" },
  ];
  assert.equal(
    resolveHandoffLatestMessage("Explicit latest message", transcript, "Fallback reason"),
    "Explicit latest message",
  );
  assert.equal(
    resolveHandoffLatestMessage(undefined, transcript, "Fallback reason"),
    "Latest customer question in transcript",
  );
  assert.equal(
    resolveHandoffLatestMessage(undefined, [], "Fallback reason"),
    "Fallback reason",
  );
});

test("visitor can dismiss an escalation offer per assistant and clear dismissed state on new conversation", () => {
  const storage = new MemoryStorage();
  const assistantA = "11111111-1111-4111-8111-111111111111";
  const assistantB = "22222222-2222-4222-8222-222222222222";
  const turn1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  assert.equal(isEscalationTurnDismissed(assistantA, turn1, storage), false);
  dismissEscalationTurn(assistantA, turn1, storage);
  assert.equal(isEscalationTurnDismissed(assistantA, turn1, storage), true);
  assert.equal(isEscalationTurnDismissed(assistantB, turn1, storage), false, "scoped by assistantId");

  clearDismissedEscalations(assistantA, storage);
  assert.equal(isEscalationTurnDismissed(assistantA, turn1, storage), false);
});

test("resolveRestoredEscalation reconstructs escalation state across reload and suppresses when handoff exists", () => {
  const req1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const req2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const customFallback = "Custom unknown answer fallback.";

  // Single abstention with contact_support -> re-offers insufficient_evidence
  const singleAbstention = [
    { role: "user" as const, content: "Unanswered question", created_at: "t1", sources: [], request_id: req1 },
    { role: "assistant" as const, content: DEFAULT_UNKNOWN_ANSWER_MESSAGE, created_at: "t2", sources: [], request_id: req1 },
  ];
  assert.deepEqual(
    resolveRestoredEscalation(singleAbstention, {
      fallbackMessage: DEFAULT_UNKNOWN_ANSWER_MESSAGE,
      handoffEnabled: true,
      unknownAnswerBehavior: "contact_support",
    }),
    { requestId: req1, reason: "insufficient_evidence" },
  );

  // Suppressed if a handoff already exists for this conversation
  assert.deepEqual(
    resolveRestoredEscalation(singleAbstention, {
      fallbackMessage: DEFAULT_UNKNOWN_ANSWER_MESSAGE,
      handoffEnabled: true,
      unknownAnswerBehavior: "contact_support",
      hasExistingHandoff: true,
    }),
    { requestId: null, reason: null },
  );

  // Repeated abstention with custom_message -> re-offers repeated_failures
  const repeatedAbstentions = [
    { role: "user" as const, content: "Unknown 1", created_at: "t1", sources: [], request_id: req1 },
    { role: "assistant" as const, content: customFallback, created_at: "t2", sources: [], request_id: req1 },
    { role: "user" as const, content: "Unknown 2", created_at: "t3", sources: [], request_id: req2 },
    { role: "assistant" as const, content: customFallback, created_at: "t4", sources: [], request_id: req2 },
  ];
  assert.deepEqual(
    resolveRestoredEscalation(repeatedAbstentions, {
      fallbackMessage: customFallback,
      handoffEnabled: true,
      unknownAnswerBehavior: "custom_message",
    }),
    { requestId: req2, reason: "repeated_failures" },
  );

  // Explicit human request turn -> re-offers explicit_request
  const explicitTurn = [
    { role: "user" as const, content: "I want to talk to a human", created_at: "t1", sources: [], request_id: req1 },
    { role: "assistant" as const, content: "I can help connect you with our support team.", created_at: "t2", sources: [], request_id: req1 },
  ];
  assert.deepEqual(
    resolveRestoredEscalation(explicitTurn, {
      fallbackMessage: DEFAULT_UNKNOWN_ANSWER_MESSAGE,
      handoffEnabled: true,
      unknownAnswerBehavior: "contact_support",
    }),
    { requestId: req1, reason: "explicit_request" },
  );
});

test("public handoff route and widget frame enforce expiry, idempotency, empty conversationId handling, and honest confirmation", async () => {
  const [handoffRoute, widgetFrame] = await Promise.all([
    readFile(new URL("../app/api/public/handoff/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/widget-frame/page.tsx", import.meta.url), "utf8"),
  ]);

  // Empty conversation_id normalized to null instead of failing UUID regex with 400
  assert.match(handoffRoute, /body\.conversation_id\.trim\(\)\.length > 0/);
  // Expiry check enforced before attaching conversation to handoff
  assert.match(handoffRoute, /expireStaleVisitorConversation\(restoreStore/);
  // Cross-tenant/cross-session conversation spoofing rejected with 403
  assert.match(handoffRoute, /if \(!ownedBeforeExpiry\) return genericError\(request, 403\)/);
  // Idempotent retry deduplication by public_token_hash
  assert.match(handoffRoute, /deduplicated:\s*true/);
  // latest_message populated via resolveHandoffLatestMessage
  assert.match(handoffRoute, /resolveHandoffLatestMessage\(body\.latest_message, transcript, reason\)/);

  // Widget frame enforces handoffEnabled and !handoffAccess on escalation prompt and contact trigger
  assert.match(widgetFrame, /handoffEnabled && !handoffAccess && item\.role === "assistant"/);
  assert.match(widgetFrame, /handoffEnabled && !handoffAccess && !showContactForm/);
  // Honest confirmation message without unconfigured response-time promises
  assert.match(widgetFrame, /Thanks! Your request has been sent to our support team\./);
  assert.doesNotMatch(widgetFrame, /We'll follow up shortly\./);
  // Double-click guard and idempotent requestId reuse on retry
  assert.match(widgetFrame, /contactSubmittingRef\.current/);
  assert.match(widgetFrame, /contactRequestIdRef\.current/);
});
