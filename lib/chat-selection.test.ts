import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  getChatConversationUrl,
  readChatConversationId,
  resolveInitialChatSelection,
} from "./chat-selection.ts";

const firstConversation = "8c995a6d-ef1a-4d19-8fb9-b46aeb7a8b2f";
const secondConversation = "0a9d68d1-6b5b-4ae4-9a22-b6b8363e3199";

test("a selected conversation ID in the URL restores after the owned history list loads", () => {
  const requestedId = readChatConversationId(`?conversation=${firstConversation}`);

  assert.deepEqual(
    resolveInitialChatSelection(requestedId, [firstConversation], false, false),
    { type: "restore", conversationId: firstConversation },
  );
});

test("refresh waits for conversation history before deciding whether a URL selection exists", () => {
  const requestedId = readChatConversationId(`?conversation=${firstConversation}`);

  assert.deepEqual(resolveInitialChatSelection(requestedId, [], true, false), { type: "wait" });
  assert.deepEqual(
    resolveInitialChatSelection(requestedId, [firstConversation], false, false),
    { type: "restore", conversationId: firstConversation },
  );
  assert.deepEqual(resolveInitialChatSelection(requestedId, [], false, true), { type: "wait" });
});

test("an explicit new chat clears only the selection and remains unselected", () => {
  const currentUrl = `http://localhost:3000/chat?view=private&conversation=${firstConversation}#messages`;

  assert.deepEqual(resolveInitialChatSelection(null, [firstConversation], false, false), { type: "new" });
  assert.equal(getChatConversationUrl(currentUrl, null), "/chat?view=private#messages");
});

test("switching conversations updates the URL so a refresh restores the latest selection", () => {
  const switchedUrl = getChatConversationUrl(`http://localhost:3000/chat?conversation=${firstConversation}`, secondConversation);
  const requestedId = readChatConversationId(new URL(switchedUrl, "http://localhost:3000").search);

  assert.equal(requestedId, secondConversation);
  assert.deepEqual(
    resolveInitialChatSelection(requestedId, [firstConversation, secondConversation], false, false),
    { type: "restore", conversationId: secondConversation },
  );
});

test("missing or inaccessible IDs are rejected against the owner's loaded list", () => {
  assert.deepEqual(resolveInitialChatSelection(secondConversation, [firstConversation], false, false), { type: "unavailable" });
});

test("the chat page restores only listed conversations and loads their saved messages", async () => {
  const page = await readFile(new URL("../app/(app)/chat/page.tsx", import.meta.url), "utf8");

  assert.match(page, /resolveInitialChatSelection\(/);
  assert.match(page, /handleSelectConversation\(selectedId\)/);
  assert.match(page, /pendingInitialSelectionRef\.current === selectedId[\s\S]*?queueMicrotask/);
  assert.match(page, /\.from\("messages"\)[\s\S]*?\.eq\(\s*"conversation_id",\s*selectedConversationId,?\s*\)/);
  assert.doesNotMatch(page, /\.from\("conversations"\)\s*\.insert\(/, "page initialization must not create a conversation");
});

test("initial selection does not create records and explicit new-chat clears the old selection", async () => {
  const page = await readFile(new URL("../app/(app)/chat/page.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");

  assert.match(page, /const handleNewChat[\s\S]*?syncConversationUrl\(null\)/);
  assert.match(page, /setRequestedConversationId\(null\)/);
  assert.match(page, /returnedConversationId[\s\S]*?syncConversationUrl\(returnedConversationId\)/);
  assert.doesNotMatch(page, /setRequestedConversationId\(returnedConversationId\)/);
  assert.match(route, /if \(!activeConversationId\)\s*\{[\s\S]*?\.from\("conversations"\)\s*\.insert\(/);
});
