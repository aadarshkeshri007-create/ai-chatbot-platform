import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { classifyChatFailure, getSafeChatFailureCode, getSafeChatFailureMessage, isChatRequestAborted, safeChatFailureDiagnostics } from "./chat-errors.ts";
import { finishChatRequest, tryStartChatRequest } from "./chat-request-guard.ts";
import { completeAfterPersistence } from "./streamed-turn.ts";

test("classifies the Google-style 504 deadline envelope without returning provider details", () => {
  const error = { error: { code: 504, message: "Deadline expired before operation could complete.", status: "DEADLINE_EXCEEDED" } };
  assert.deepEqual(classifyChatFailure(error), {
    category: "deadline_exceeded", status: 504,
    message: "The assistant service timed out. Please retry shortly.",
  });
  assert.deepEqual(safeChatFailureDiagnostics(error), {
    category: "deadline_exceeded", errorName: "UpstreamError", upstreamStatus: "DEADLINE_EXCEEDED",
  });
  assert.doesNotMatch(JSON.stringify(safeChatFailureDiagnostics(error)), /Deadline expired/);
});

test("non-timeout errors and aborted requests stay safe and do not invite automatic retries", () => {
  const classified = classifyChatFailure(new Error("private prompt content"));
  assert.equal(classified.status, 500);
  assert.doesNotMatch(classified.message, /private prompt content/);
  assert.match(getSafeChatFailureMessage({ status: 504 }), /timed out/i);
  assert.match(getSafeChatFailureMessage(new Error("Failed to fetch")), /couldn’t complete/i);
  const controller = new AbortController();
  controller.abort();
  assert.equal(isChatRequestAborted(new Error("aborted"), controller.signal), true);
  assert.equal(isChatRequestAborted(Object.assign(new Error("aborted"), { name: "AbortError" })), false);
});

test("Gemini SDK timeout AbortError is classified as a deadline, not a client disconnect", () => {
  const error = Object.assign(new Error("This operation was aborted"), { name: "AbortError", code: 20 });
  assert.deepEqual(classifyChatFailure(error), {
    category: "deadline_exceeded", status: 504,
    message: "The assistant service timed out. Please retry shortly.",
  });
  assert.deepEqual(safeChatFailureDiagnostics(error), {
    category: "deadline_exceeded", errorName: "AbortError", timeoutSource: "gemini_sdk",
  });
  assert.equal(getSafeChatFailureMessage(error), "The assistant service timed out. Please retry shortly.");
  const controller = new AbortController();
  assert.equal(isChatRequestAborted(error, controller.signal), false);
  controller.abort();
  assert.equal(isChatRequestAborted(error, controller.signal), true);
});

test("SSE error codes preserve safe timeout and persistence messages in the chat UI", () => {
  assert.equal(getSafeChatFailureCode({ code: "DEADLINE_EXCEEDED", message: "safe" }), "DEADLINE_EXCEEDED");
  assert.equal(getSafeChatFailureMessage({ code: "DEADLINE_EXCEEDED", message: "safe" }), "The assistant service timed out. Please retry shortly.");
  assert.equal(getSafeChatFailureCode({ code: "PERSISTENCE_FAILED" }), "PERSISTENCE_FAILED");
  assert.equal(getSafeChatFailureMessage({ code: "PERSISTENCE_FAILED", message: "database secret" }), "Your response could not be saved. Please retry.");
});

test("the chat request lock blocks duplicate submits and releases after completion", () => {
  const lock = { current: false };
  assert.equal(tryStartChatRequest(lock), true);
  assert.equal(tryStartChatRequest(lock), false);
  finishChatRequest(lock);
  assert.equal(tryStartChatRequest(lock), true);
});

test("stream errors stay in SSE after headers, and completion remains persistence-gated", async () => {
  const route = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
  assert.match(route, /send\("error", \{ code: failure\.category/);
  assert.match(route, /Content-Type", "text\/event-stream/);
  assert.match(route, /ANSWER_GENERATION_TIMEOUT_MS = 45_000/);
  assert.match(route, /httpOptions: \{ timeout: 30_000 \}/);
  assert.match(route, /generateGroundedAnswerStream\(\s*answerAi/);
  const page = await readFile(new URL("../app/(app)/chat/page.tsx", import.meta.url), "utf8");
  assert.match(page, /getSafeChatFailureMessage\(payload\)/);
  assert.match(page, /getSafeChatFailureCode\(payload\)/);
  const events: string[] = [];
  const ok = await completeAfterPersistence(async () => null, () => events.push("complete"), () => events.push("error"));
  assert.equal(ok, false);
  assert.deepEqual(events, ["error"]);
});
