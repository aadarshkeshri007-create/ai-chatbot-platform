import assert from "node:assert/strict";
import test from "node:test";

import {
  formatRateLimitMessage,
  isWidgetChatRequest,
  isWidgetChatResponse,
  isTrustedWidgetMessage,
  parseRetryAfterSeconds,
  WIDGET_MAX_MESSAGE_LENGTH,
} from "./widget-protocol.ts";

test("parses and bounds valid Retry-After seconds", () => {
  assert.equal(parseRetryAfterSeconds("42"), 42);
  assert.equal(parseRetryAfterSeconds(" 0 "), 0);
  assert.equal(parseRetryAfterSeconds("999"), 300);
});

test("rejects missing, malformed, negative, and unsafe Retry-After values", () => {
  assert.equal(parseRetryAfterSeconds(null), null);
  assert.equal(parseRetryAfterSeconds(""), null);
  assert.equal(parseRetryAfterSeconds("1.5"), null);
  assert.equal(parseRetryAfterSeconds("-1"), null);
  assert.equal(parseRetryAfterSeconds("9007199254740992"), null);
});

test("formats useful rate-limit messages with or without a valid delay", () => {
  assert.equal(
    formatRateLimitMessage(12),
    "Too many requests. Please wait 12 seconds before trying again.",
  );
  assert.equal(
    formatRateLimitMessage(null),
    "Too many requests. Please wait before trying again.",
  );
});

test("trusts only messages from the expected iframe window and origin", () => {
  const iframeWindow = {};
  assert.equal(
    isTrustedWidgetMessage(iframeWindow, iframeWindow, "https://support.example", "https://support.example"),
    true,
  );
  assert.equal(
    isTrustedWidgetMessage({}, iframeWindow, "https://support.example", "https://support.example"),
    false,
  );
  assert.equal(
    isTrustedWidgetMessage(iframeWindow, iframeWindow, "https://attacker.example", "https://support.example"),
    false,
  );
});

test("accepts a valid host-page chat request", () => {
  assert.equal(
    isWidgetChatRequest({
      type: "supportai:chat-request",
      requestId: "request-1",
      assistantId: "forged-id",
      message: "Where is my order?",
    }),
    true,
  );
});

test("rejects malformed and oversized iframe messages", () => {
  assert.equal(isWidgetChatRequest({ type: "supportai:chat-request", requestId: "1" }), false);
  assert.equal(
    isWidgetChatRequest({
      type: "supportai:chat-request",
      requestId: "1",
      message: "x".repeat(WIDGET_MAX_MESSAGE_LENGTH + 1),
    }),
    false,
  );
});

test("does not authorize an iframe-supplied assistant ID", () => {
  const request = {
    type: "supportai:chat-request",
    requestId: "request-1",
    assistantId: "forged-id",
    message: "hello",
  };
  assert.equal(isWidgetChatRequest(request), true);
  assert.notEqual(request.assistantId, "the-controller-assistant-id");
});

test("accepts only well-formed correlated responses", () => {
  assert.equal(
    isWidgetChatResponse({
      type: "supportai:chat-response",
      requestId: "request-1",
      ok: true,
      payload: { response: "Answer" },
    }),
    true,
  );
  assert.equal(
    isWidgetChatResponse({
      type: "supportai:chat-response",
      requestId: "request-2",
      ok: false,
      error: "Origin is not allowed.",
      status: 429,
      retryAfterSeconds: 12,
    }),
    true,
  );
  assert.equal(
    isWidgetChatResponse({
      type: "supportai:chat-response",
      requestId: "request-1",
      ok: true,
      payload: null,
    }),
    false,
  );
});
