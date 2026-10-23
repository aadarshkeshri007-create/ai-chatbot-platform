import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { getMessageCitationChips } from "./message-citations.ts";

test("citation chips stay attached to the assistant message that owns them", () => {
  const first = getMessageCitationChips({ sources: [
    { label: "handbook.pdf", document_id: "doc-1", chunk_id: "chunk-1", chunk_index: 3 },
  ] });
  const second = getMessageCitationChips({ sources: [
    { label: "returns.pdf", document_id: "doc-2", chunk_id: "chunk-2", chunk_index: 1 },
  ] });
  assert.deepEqual(first.map(({ label }) => label), ["handbook.pdf · Section 4"]);
  assert.deepEqual(second.map(({ label }) => label), ["returns.pdf · Section 2"]);
  assert.notEqual(first[0].key, second[0].key);
});

test("multiple chunks from one document keep stable unique keys and exact duplicates collapse", () => {
  const chips = getMessageCitationChips({ sources: [
    { label: "handbook.pdf", document_id: "doc-1", chunk_id: "chunk-1", chunk_index: 3 },
    { label: "handbook.pdf", document_id: "doc-1", chunk_id: "chunk-2", chunk_index: 4 },
    { label: "handbook.pdf", document_id: "doc-1", chunk_id: "chunk-1", chunk_index: 3 },
  ] });
  assert.equal(chips.length, 2);
  assert.notEqual(chips[0].key, chips[1].key);
});

test("empty citations produce no citation chips or rendered source list", async () => {
  assert.deepEqual(getMessageCitationChips({ sources: [] }), []);
  const bubble = await readFile(new URL("../components/chat/MessageBubble.tsx", import.meta.url), "utf8");
  assert.match(bubble, /citations\.length > 0 \? \(/);
});
