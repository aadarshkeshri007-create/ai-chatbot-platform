import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Source-level contract checks. These guard wiring that unit tests with fakes
 * cannot see (the route, the host loader and the frame). They are not a
 * substitute for exercising the routes against a live Supabase project.
 */
const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("chat route restores through the scoped store and enforces expiry before persisting a turn", async () => {
  const route = await read("../app/api/public/chat/route.ts");
  assert.match(route, /resolveWidgetRetentionDays\(process\.env\.WIDGET_CONVERSATION_RETENTION_DAYS\)/);
  const restoreIdx = route.indexOf("restoreWidgetConversation(restoreStore");
  const expireIdx = route.indexOf("expireStaleVisitorConversation(restoreStore");
  const idempotencyIdx = route.indexOf('.eq("client_message_id", body.request_id)');
  const rpcIdx = route.indexOf('supabase.rpc("persist_public_chat_turn"');
  assert.ok(restoreIdx > 0 && expireIdx > restoreIdx, "restore path then expiry check on chat path");
  assert.ok(expireIdx < idempotencyIdx && idempotencyIdx < rpcIdx, "expiry runs before idempotency lookup and persistence");
  // Authorization inputs: validated assistant + hashed session only, never a client conversation id.
  assert.doesNotMatch(route, /body\.conversation_id|conversation_id:\s*body/);
  assert.match(route, /isAllowedAssistantOrigin\(request, assistant\.allowed_domains\)/);
  assert.ok(route.indexOf("isAllowedAssistantOrigin(request") < restoreIdx, "origin allow-list is checked before any read");
  assert.doesNotMatch(route, /session_token[^\n]*console\.|console\.[^\n]*sessionToken/);
});

test("restore store scopes every query by assistant and hashed session or by the already-authorized conversation", async () => {
  const store = await read("./widget-restore-store.ts");
  const conversationQueries = store.match(/from\("conversations"\)[\s\S]*?(?=\n    },|\n    async)/g) ?? [];
  assert.equal(conversationQueries.length, 2);
  for (const query of conversationQueries) {
    assert.match(query, /\.eq\("assistant_id", assistantId\)/);
    assert.match(query, /\.eq\("visitor_session_hash", sessionHash\)/);
  }
  assert.match(store, /\.lt\("updated_at", cutoff\.toISOString\(\)\)/);
  assert.doesNotMatch(store, /\.delete\(/, "expiry must retain history rather than delete it");
});

test("host loader persists the resume credential durably, scoped by assistant, and never logs it", async () => {
  const loader = await read("../app/widget.js/route.ts");
  assert.match(loader, /supportai:visitor-session:" \+ assistantId/);
  assert.match(loader, /\[\(\) => window\.localStorage, \(\) => window\.sessionStorage\]/);
  assert.match(loader, /saveVisitorSessionToken\(visitorStorages, sessionStorageKey, visitorSessionToken\)/);
  assert.doesNotMatch(loader, /console\.[a-z]+\([^)]*visitorSessionToken/);
});

test("frame shows a loading state, a retry path, and never auto-submits a recovered question", async () => {
  const frame = await read("../app/widget-frame/page.tsx");
  assert.match(frame, /Restoring your conversation…/);
  assert.match(frame, /restoreState === "failed"/);
  assert.match(frame, /onClick=\{requestRestore\}/);
  assert.match(frame, /Start a new conversation/);
  assert.match(frame, /disabled=\{loading \|\| Boolean\(handoffAccess\) \|\| restoreState !== "ready"\}/);
  assert.match(frame, /prefers-color-scheme|prefers-reduced-motion: reduce\) \{ \.restore-status/);
  // Recovered questions are placed back into the input with their original request id.
  assert.match(frame, /retryRef\.current = \{ requestId: pending\.requestId, message: pending\.message \}/);
  assert.match(frame, /clearPendingQuestion\(assistantId, localStorage\)/);
  // Regression: restored messages carry camelCase requestId; the classifier expects request_id.
  assert.match(frame, /classifyPendingQuestion\(pending, restored\.map\(\(item\) => \(\{ role: item\.role, request_id: item\.requestId \}\)\)\)/);
  // Failure must not clear stored state or fall back to an empty chat.
  const failure = frame.slice(frame.indexOf("event.data.ok !== true"), frame.indexOf("const payload = event.data.payload as"));
  assert.match(failure, /setRestoreState\("failed"\)/);
  assert.doesNotMatch(failure, /setMessages|clearPendingQuestion|rotate-visitor-session/);
});

test("theme, lead capture and escalation wiring in the frame are unchanged by persistence", async () => {
  const frame = await read("../app/widget-frame/page.tsx");
  assert.match(frame, /useState<"light" \| "dark">\("light"\)/, "deterministic theme initial state");
  assert.match(frame, /supportai:widget-theme/);
  assert.match(frame, /submitContactSupport/);
  assert.match(frame, /setEscalatedTurnId\(requestId\)/);
  assert.match(frame, /prefers-reduced-motion/);
});
