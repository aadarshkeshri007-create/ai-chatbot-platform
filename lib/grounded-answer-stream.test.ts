import assert from "node:assert/strict";
import test from "node:test";
import { generateGroundedAnswerStream, GROUNDED_ANSWER_FALLBACK, readPartialJsonStringField } from "./grounded-answer.ts";

function mockAi(parts: string[]) {
  return {
    models: {
      generateContentStream: async () => (async function* () {
        for (const text of parts) yield { text };
      })(),
    },
  } as never;
}

const source = [{ id: "chunk-1", file_name: "guide.pdf", content: "Refund window is 30 days.", chunk_index: 0 }];

test("grounded answer stream emits ordered text only after source references validate", async () => {
  const deltas: string[] = [];
  const answer = await generateGroundedAnswerStream(
    mockAi(['{"sourceNumbers":[1],"answer":"Refunds are available ', 'within 30 days."', "}"]),
    "What is the refund window?",
    source,
    "Use the provided source.",
    (delta) => deltas.push(delta),
  );
  assert.deepEqual(deltas, ["Refunds are available ", "within 30 days."]);
  assert.deepEqual(answer, { answer: "Refunds are available within 30 days.", sourceNumbers: [1] });
});

test("stream parser handles incomplete JSON escapes without corrupting text", () => {
  assert.deepEqual(readPartialJsonStringField('{"answer":"line\\n', "answer"), {
    value: "line\n",
    complete: false,
  });
  assert.deepEqual(readPartialJsonStringField('{"answer":"line\\nend"}', "answer"), {
    value: "line\nend",
    complete: true,
  });
});

test("ungrounded streamed answer text is not released before citations validate", async () => {
  const deltas: string[] = [];
  const answer = await generateGroundedAnswerStream(
    mockAi(['{"sourceNumbers":[],"answer":"Unsupported claim"}']),
    "Question",
    source,
    "Use the provided source.",
    (delta) => deltas.push(delta),
  );
  assert.equal(answer, null);
  assert.deepEqual(deltas, []);
});

test("safe abstention can stream without claiming a source", async () => {
  const deltas: string[] = [];
  const answer = await generateGroundedAnswerStream(
    mockAi([`{"sourceNumbers":[],"answer":${JSON.stringify(GROUNDED_ANSWER_FALLBACK)}}`]),
    "Unsupported question",
    source,
    "Use the provided source.",
    (delta) => deltas.push(delta),
  );
  assert.deepEqual(answer, { answer: GROUNDED_ANSWER_FALLBACK, sourceNumbers: [] });
  assert.equal(deltas.join(""), GROUNDED_ANSWER_FALLBACK);
});
