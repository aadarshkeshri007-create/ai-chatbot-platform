import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { getChatSourceKey } from "./chat-source-key.ts";

test("citations from different chunks in the same document receive distinct stable keys", () => {
  const sectionOne = { documentId: "doc-1", fileName: "guide.pdf", chunkId: "chunk-1", chunkIndex: 0 };
  const sectionTwo = { documentId: "doc-1", fileName: "guide.pdf", chunkId: "chunk-2", chunkIndex: 1 };
  assert.notEqual(getChatSourceKey(sectionOne), getChatSourceKey(sectionTwo));
  assert.equal(getChatSourceKey(sectionOne), getChatSourceKey({ ...sectionOne }));
});

test("older citation records without chunk IDs use their document and section identity", () => {
  assert.notEqual(
    getChatSourceKey({ documentId: "doc-1", fileName: "guide.pdf", chunkIndex: 0 }),
    getChatSourceKey({ documentId: "doc-1", fileName: "guide.pdf", chunkIndex: 1 }),
  );
});

test("Chat keeps message identity and stream reconciliation keyed by message IDs", async () => {
  const [page, messages, bubble] = await Promise.all([
    readFile(new URL("../app/(app)/chat/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/chat/ChatMessage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/chat/MessageBubble.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /item\.id === userMessageId/);
  assert.match(page, /item\.id === assistantMessageId/);
  assert.match(bubble, /getMessageCitationChips\(message\)/);
  assert.match(bubble, /key=\{citation\.key\}/);
  assert.match(messages, /key=\{message\.id\}/);
});
