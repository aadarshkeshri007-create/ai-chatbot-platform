import assert from "node:assert/strict";
import test from "node:test";

import {
  createPublicChatCorrelationId,
  getSafeErrorCode,
} from "./public-chat-errors.ts";

test("creates UUID correlation IDs", () => {
  assert.match(
    createPublicChatCorrelationId(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test("preserves only safe structured error codes", () => {
  assert.equal(getSafeErrorCode({ code: "PGRST116" }), "PGRST116");
  assert.equal(getSafeErrorCode({ code: "provider-timeout" }), "UNKNOWN_ERROR");
  assert.equal(getSafeErrorCode({ code: "secret=should-not-log" }), "UNKNOWN_ERROR");
  assert.equal(getSafeErrorCode(new Error("provider secret")), "UNKNOWN_ERROR");
  assert.equal(getSafeErrorCode(null), "UNKNOWN_ERROR");
});

