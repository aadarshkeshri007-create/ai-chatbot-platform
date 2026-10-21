import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { submitFeedbackOnce } from "./answer-feedback.ts";

test("feedback is confirmed only after the save operation succeeds", async () => {
  const lock = { current: false };
  const result = await submitFeedbackOnce(lock, async () => {});
  assert.deepEqual(result, { status: "saved" });
  assert.equal(lock.current, false);
});

test("failed feedback remains retryable and duplicate in-flight submissions are blocked", async () => {
  const lock = { current: false };
  let release!: () => void;
  const pending = submitFeedbackOnce(lock, () => new Promise<void>((_resolve, reject) => {
    release = () => reject(new Error("temporary failure"));
  }));
  assert.deepEqual(await submitFeedbackOnce(lock, async () => {}), { status: "busy" });
  release();
  const failed = await pending;
  assert.equal(failed.status, "failed");
  assert.equal(lock.current, false);
  if (failed.status === "failed") assert.match(String(failed.error), /temporary failure/);
});

test("feedback controls are replaced only on success; errors retain retry controls", async () => {
  const bubble = await readFile(new URL("../components/chat/MessageBubble.tsx", import.meta.url), "utf8");
  assert.match(bubble, /if \(result\.status === "saved"\) \{\s*setSaved\(true\)/);
  assert.match(bubble, /\{!saved \? <>/);
  assert.match(bubble, /if \(result\.status === "failed"\)/);
  assert.match(bubble, /Feedback recorded/);
});
