import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolveRetrievalQuery } from "./query-rewrite.ts";

test("uses a successful standalone rewrite for retrieval", async () => {
  const result = await resolveRetrievalQuery("What about it?", true, async () => "What is the warranty period?");
  assert.deepEqual(result, { query: "What is the warranty period?", outcome: "rewritten" });
});

test("skips rewriting when there is no prior conversation history", async () => {
  let calls = 0;
  const result = await resolveRetrievalQuery("What is the refund policy?", false, async () => { calls += 1; return "rewritten"; });
  assert.deepEqual(result, { query: "What is the refund policy?", outcome: "original_query" });
  assert.equal(calls, 0);
});

test("a Gemini 504 uses the original query once without retrying the model", async () => {
  let calls = 0;
  const result = await resolveRetrievalQuery("What about it?", true, async () => {
    calls += 1;
    throw { error: { code: 504, status: "DEADLINE_EXCEEDED", message: "Deadline expired." } };
  });
  assert.deepEqual(result, { query: "What about it?", outcome: "original_after_timeout" });
  assert.equal(calls, 1);
});

test("non-deadline rewrite failures still follow the API error path", async () => {
  const failure = new Error("provider failure");
  await assert.rejects(
    resolveRetrievalQuery("What about it?", true, async () => { throw failure; }),
    (error) => error === failure,
  );
});

test("an aborted request never converts a deadline into retrieval fallback", async () => {
  await assert.rejects(
    resolveRetrievalQuery("What about it?", true, async () => {
      throw { error: { code: 504, status: "DEADLINE_EXCEEDED" } };
    }, () => true),
  );
});

test("fallback continues through existing user-scoped retrieval and one persistence/answer path", async () => {
  const route = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
  assert.match(route, /match_document_chunks[\s\S]*filter_user_id: user\.id/);
  assert.match(route, /keyword_search_document_chunks[\s\S]*filter_user_id: user\.id/);
  assert.match(route, /\.eq\("assistant_id", profile\.assistant_id\)/);
  assert.equal((route.match(/generateGroundedAnswerStream\(/g) ?? []).length, 1);
  assert.equal((route.match(/client_message_id: userMessageId/g) ?? []).length, 1);
  assert.equal((route.match(/client_message_id: assistantMessageId/g) ?? []).length, 1);
  assert.match(route, /retrievalQueryResult\.query/);
  assert.match(route, /original_after_timeout/);
});
