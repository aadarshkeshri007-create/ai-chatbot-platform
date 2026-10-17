import test from "node:test";
import assert from "node:assert/strict";

import {
  createHandoffAccessToken,
  createHandoffTokenHash,
  normalizeEmail,
  parseTranscript,
} from "./handoff.ts";

test("normalizes and validates customer email", () => {
  assert.equal(normalizeEmail(" Customer@Example.com "), "customer@example.com");
  assert.equal(normalizeEmail("not-an-email"), null);
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

test("creates a token that verifies through its hash", () => {
  const access = createHandoffAccessToken();
  assert.equal(createHandoffTokenHash(access.token), access.hash);
  assert.notEqual(access.token, access.hash);
});
