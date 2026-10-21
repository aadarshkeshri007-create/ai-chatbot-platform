import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { shouldAutoScrollToBottom } from "./chat-scroll.ts";

test("chat follows new messages near the bottom and preserves a reader's scroll position", () => {
  assert.equal(shouldAutoScrollToBottom(1000, 776, 200), true);
  assert.equal(shouldAutoScrollToBottom(1000, 700, 200), false);
});

test("conversation selection restores bottom-follow behavior and clears stale citations", async () => {
  const page = await readFile(new URL("../app/(app)/chat/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const handleSelectConversation[\s\S]*?setMessages\([\s\S]*?shouldAutoScrollRef\.current\s*=\s*true/);
  assert.match(page, /setMessages\([\s\S]*?sources: Array\.isArray\(msg\.sources\)/);
  assert.match(page, /shouldAutoScrollToBottom\(/);
});
