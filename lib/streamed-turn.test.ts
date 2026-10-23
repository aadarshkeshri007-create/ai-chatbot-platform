import assert from "node:assert/strict";
import test from "node:test";
import { completeAfterPersistence } from "./streamed-turn.ts";

test("stream completion is emitted only after persistence succeeds", async () => {
  const events: string[] = [];
  const completed = await completeAfterPersistence(
    async () => ({ id: "saved-turn" }),
    () => events.push("complete"),
    () => events.push("error"),
  );
  assert.equal(completed, true);
  assert.deepEqual(events, ["complete"]);
});

test("failed or unavailable persistence emits failure and never completion", async () => {
  for (const persist of [async () => null, async () => { throw new Error("database failure"); }]) {
    const events: string[] = [];
    const completed = await completeAfterPersistence(
      persist,
      () => events.push("complete"),
      () => events.push("error"),
    );
    assert.equal(completed, false);
    assert.deepEqual(events, ["error"]);
  }
});
