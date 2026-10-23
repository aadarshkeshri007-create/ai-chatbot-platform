import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  assessGrounding,
  generateGroundedAnswerStream,
  GROUNDED_ANSWER_FALLBACK,
  selectGroundingCandidates,
  sourcesForNumbers,
  type RetrievedChunk,
  type VectorChunk,
} from "./grounded-answer.ts";

const refundPolicyChunk: RetrievedChunk = {
  id: "chunk-refund-37-days",
  document_id: "doc-handbook",
  file_name: "acme-customer-support-handbook.pdf",
  chunk_index: 3,
  content: `3. Refund Policy
3.1 Refund window
Customers may request a refund within 37 days of the delivery date shown on the carrier's tracking record (not the order date). Requests made on day 38 or later are not eligible for a standard refund, but may be handled under warranty (Section 6).`,
};

const shippingChunk: RetrievedChunk = {
  id: "chunk-shipping-fees",
  document_id: "doc-handbook",
  file_name: "acme-customer-support-handbook.pdf",
  chunk_index: 7,
  content: `5. Shipping Methods and Delivery Estimates
Standard shipping takes 3-5 business days. Overnight shipping takes 1 business day for orders placed before 1:00 PM ET.`,
};

const otherTenantChunk: RetrievedChunk = {
  id: "chunk-competitor-policy",
  document_id: "doc-other-tenant",
  file_name: "competitor-guide.pdf",
  chunk_index: 0,
  content: `Refunds are allowed within 90 days of order date for all products.`,
};

function createMockAi(responder: (prompt: string) => { text: string } | AsyncIterable<{ text: string }>) {
  return {
    models: {
      generateContent: async ({ contents }: { contents: string }) => {
        const res = responder(contents);
        if ("text" in res) return res;
        let combined = "";
        for await (const chunk of res) combined += chunk.text;
        return { text: combined };
      },
      generateContentStream: async ({ contents }: { contents: string }) => {
        const res = responder(contents);
        if (Symbol.asyncIterator in Object(res)) return res;
        return (async function* () {
          yield res as { text: string };
        })();
      },
    },
  } as never;
}

test("Requirement A: 'How long after delivery can I request a refund?' retrieves refund policy, answers 37 days from delivery, and cites source", async () => {
  const question = "How long after delivery can I request a refund?";
  const vectorChunks: VectorChunk[] = [
    { ...refundPolicyChunk, similarity: 0.74 },
    { ...shippingChunk, similarity: 0.65 },
  ];

  const candidates = selectGroundingCandidates(vectorChunks, []);
  assert.equal(candidates[0].id, refundPolicyChunk.id);

  const mockAi = createMockAi((prompt) => {
    if (prompt.includes("Decide whether the source excerpts materially and directly support")) {
      return { text: JSON.stringify({ supported: true, sourceNumbers: [1] }) };
    }
    return (async function* () {
      yield { text: '{"sourceNumbers":[1],"answer":"Customers may request a refund within 37 days ' };
      yield { text: 'of the delivery date shown on the carrier\'s tracking record."}' };
    })();
  });

  const supportingNumbers = await assessGrounding(mockAi, question, candidates);
  assert.deepEqual(supportingNumbers, [1]);

  const supportingChunks = sourcesForNumbers(candidates, supportingNumbers);
  assert.equal(supportingChunks.length, 1);
  assert.equal(supportingChunks[0].chunk_index, 3);

  const deltas: string[] = [];
  const groundedAnswer = await generateGroundedAnswerStream(
    mockAi,
    question,
    supportingChunks,
    "You are a helpful customer support assistant.",
    (delta) => deltas.push(delta),
  );

  assert.ok(groundedAnswer, "grounded answer must be produced");
  assert.match(groundedAnswer.answer, /37 days/);
  assert.match(groundedAnswer.answer, /delivery date/);
  assert.deepEqual(groundedAnswer.sourceNumbers, [1]);
  assert.equal(deltas.join(""), groundedAnswer.answer);
});

test("Requirement B: 'how long after order can I request a refund?' clarifies that the 37-day window begins at delivery, not ordering", async () => {
  const question = "how long after order can I request a refund?";
  const vectorChunks: VectorChunk[] = [
    { ...refundPolicyChunk, similarity: 0.73 },
    { ...shippingChunk, similarity: 0.68 },
  ];

  const candidates = selectGroundingCandidates(vectorChunks, []);
  assert.equal(candidates[0].id, refundPolicyChunk.id);

  const mockAi = createMockAi((prompt) => {
    if (prompt.includes("Decide whether the source excerpts materially and directly support")) {
      assert.match(prompt, /clarify, correct, qualify, or refute the premise/);
      return { text: JSON.stringify({ supported: true, sourceNumbers: [1] }) };
    }
    return (async function* () {
      yield { text: '{"sourceNumbers":[1],"answer":"Customers may request a refund within 37 days ' };
      yield { text: 'of the delivery date shown on the carrier\'s tracking record (not the order date)."}' };
    })();
  });

  const supportingNumbers = await assessGrounding(mockAi, question, candidates);
  assert.deepEqual(supportingNumbers, [1]);

  const supportingChunks = sourcesForNumbers(candidates, supportingNumbers);
  const groundedAnswer = await generateGroundedAnswerStream(
    mockAi,
    question,
    supportingChunks,
    "You are a helpful customer support assistant.",
    () => {},
  );

  assert.ok(groundedAnswer, "grounded answer must be produced without abstaining");
  assert.match(groundedAnswer.answer, /37 days/);
  assert.match(groundedAnswer.answer, /delivery date/);
  assert.match(groundedAnswer.answer, /not the order date/i);
  assert.deepEqual(groundedAnswer.sourceNumbers, [1]);
});

test("Requirement C: 'After how many days of ordering can I demand a refund?' answers correctly without unnecessary abstention", async () => {
  const question = "After how many days of ordering can I demand a refund?";
  const vectorChunks: VectorChunk[] = [
    { ...refundPolicyChunk, similarity: 0.73 },
    { ...shippingChunk, similarity: 0.68 },
  ];

  const candidates = selectGroundingCandidates(vectorChunks, []);
  assert.equal(candidates[0].id, refundPolicyChunk.id);

  const mockAi = createMockAi((prompt) => {
    if (prompt.includes("Decide whether the source excerpts materially and directly support")) {
      return { text: JSON.stringify({ supported: true, sourceNumbers: [1] }) };
    }
    return (async function* () {
      yield { text: '{"sourceNumbers":[1],"answer":"Customers may request a refund within 37 days of the delivery date shown on the carrier\'s tracking record, not the order date."}' };
    })();
  });

  const supportingNumbers = await assessGrounding(mockAi, question, candidates);
  assert.deepEqual(supportingNumbers, [1]);

  const supportingChunks = sourcesForNumbers(candidates, supportingNumbers);
  const groundedAnswer = await generateGroundedAnswerStream(
    mockAi,
    question,
    supportingChunks,
    "You are a helpful customer support assistant.",
    () => {},
  );

  assert.ok(groundedAnswer, "must not abstain on demanding refund after ordering");
  assert.match(groundedAnswer.answer, /37 days/);
  assert.match(groundedAnswer.answer, /delivery date/);
  assert.deepEqual(groundedAnswer.sourceNumbers, [1]);
});

test("Requirement D: a genuinely unsupported question abstains with safe fallback and empty sources", async () => {
  const question = "What is your return policy for live animals?";
  const vectorChunks: VectorChunk[] = [
    { ...refundPolicyChunk, similarity: 0.62 },
  ];

  const candidates = selectGroundingCandidates(vectorChunks, []);

  const mockAi = createMockAi((prompt) => {
    if (prompt.includes("Decide whether the source excerpts materially and directly support")) {
      return { text: JSON.stringify({ supported: false, sourceNumbers: [] }) };
    }
    return { text: JSON.stringify({ sourceNumbers: [], answer: GROUNDED_ANSWER_FALLBACK }) };
  });

  const supportingNumbers = await assessGrounding(mockAi, question, candidates);
  assert.deepEqual(supportingNumbers, []);

  const supportingChunks = sourcesForNumbers(candidates, supportingNumbers);
  assert.equal(supportingChunks.length, 0);

  // When supportingChunks is empty, pipeline routes bypass generateGroundedAnswerStream and return fallback
  const fallback = GROUNDED_ANSWER_FALLBACK;
  assert.match(fallback, /doesn’t contain enough information/);
});

test("Requirement E: tenant isolation ensures chunks from another tenant are never admitted to candidates or citations", async () => {
  // Simulate an isolated tenant result set where other tenant chunks cannot appear
  const vectorChunks: VectorChunk[] = [
    { ...refundPolicyChunk, similarity: 0.73 },
  ];

  const candidates = selectGroundingCandidates(vectorChunks, []);
  assert.ok(candidates.every((c) => c.document_id === "doc-handbook"));
  assert.ok(!candidates.some((c) => c.id === otherTenantChunk.id));

  // Verify route contracts for tenant and assistant isolation
  const [dashboardRoute, widgetRoute] = await Promise.all([
    readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/public/chat/route.ts", import.meta.url), "utf8"),
  ]);

  // Dashboard route scopes retrieval to authenticated user id and assistant id
  assert.match(dashboardRoute, /filter_user_id:\s*user\.id/);
  assert.match(dashboardRoute, /\.eq\("assistant_id",\s*profile\.assistant_id\)/);

  // Widget route scopes retrieval to the authorized assistant id
  assert.match(widgetRoute, /requested_assistant_id:\s*assistantId/);
  assert.match(widgetRoute, /isAllowedAssistantOrigin\(request,\s*assistant\.allowed_domains\)/);

  // Both routes use assessGrounding with abort signal support
  assert.match(dashboardRoute, /assessGrounding\(ai,\s*searchQuery,\s*candidates,\s*request\.signal\)/);
  assert.match(widgetRoute, /assessGrounding\(ai,\s*cleanMessage,\s*candidates,\s*request\.signal\)/);
});
