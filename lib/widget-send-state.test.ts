import test from "node:test";
import assert from "node:assert/strict";
import { canSubmitWidgetMessage } from "./widget-send-state.ts";

const ready = {
  loading: false,
  handoffActive: false,
  assistantReady: true,
  submissionPending: false,
};

test("allows a nonblank message when chat is ready", () => {
  assert.equal(canSubmitWidgetMessage(" Hello ", ready), true);
});

test("blocks blank messages, active handoff, and unavailable assistants", () => {
  assert.equal(canSubmitWidgetMessage("  \n", ready), false);
  assert.equal(canSubmitWidgetMessage("Hello", { ...ready, handoffActive: true }), false);
  assert.equal(canSubmitWidgetMessage("Hello", { ...ready, assistantReady: false }), false);
});

test("blocks submissions while a request is loading or pending", () => {
  assert.equal(canSubmitWidgetMessage("Hello", { ...ready, loading: true }), false);
  assert.equal(canSubmitWidgetMessage("Hello", { ...ready, submissionPending: true }), false);
});
