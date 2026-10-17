import assert from "node:assert/strict";
import test from "node:test";

import { mergeHandoffTranscript } from "./handoff-transcript.ts";

test("displays a message with the same persisted ID from two sources once", () => {
  const result = mergeHandoffTranscript(
    [{ id: "message-1", role: "user", content: "Hello", created_at: "2026-01-01T00:00:00Z" }],
    [{ id: "message-1", role: "customer", content: "Hello", created_at: "2026-01-01T00:00:00Z" }],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "message-1");
  assert.equal(result[0].source, "handoff_message");
});

test("preserves distinct identical customer messages", () => {
  const result = mergeHandoffTranscript(
    [
      { role: "user", content: "Hello" },
      { role: "user", content: "Hello" },
    ],
    [
      { id: "message-1", role: "customer", content: "Hello", created_at: "2026-01-01T00:00:00Z" },
      { id: "message-2", role: "customer", content: "Hello", created_at: "2026-01-01T00:01:00Z" },
    ],
  );
  assert.deepEqual(result.map((message) => message.id), ["message-1", "message-2"]);
});

test("preserves sender classification and chronological order", () => {
  const result = mergeHandoffTranscript(
    [
      { role: "user", content: "Question", created_at: "2026-01-01T00:00:00Z" },
      { role: "assistant", content: "I cannot answer that.", created_at: "2026-01-01T00:01:00Z" },
    ],
    [{ id: "human-1", role: "human", content: "I can help.", created_at: "2026-01-01T00:02:00Z" }],
  );
  assert.deepEqual(result.map((message) => message.role), ["customer", "assistant", "human"]);
  assert.deepEqual(result.map((message) => message.content), [
    "Question",
    "I cannot answer that.",
    "I can help.",
  ]);
});
