import assert from "node:assert/strict";
import test from "node:test";
import { filterHistoryEntries, mergeLinkedHandoffs, paginateHistoryEntries, type HistoryEntry } from "./history.ts";

const ai: HistoryEntry = {
  id: "conversation-1", kind: "ai", title: "Order status", customer: "Assistant chat", status: "all",
  firstActivityAt: "2026-10-01T10:00:00.000Z", lastActivityAt: "2026-10-01T10:05:00.000Z",
  preview: "Where is my order?", archived: false, searchText: "Order status Where is my order?",
};

test("linked handoffs appear once as a mixed interaction", () => {
  const [entry] = mergeLinkedHandoffs([{ ...ai }], [{
    id: "handoff-1", conversationId: ai.id, kind: "handoff", handoffId: "handoff-1", title: "Order status",
    customer: "Visitor", status: "resolved", firstActivityAt: ai.firstActivityAt,
    lastActivityAt: "2026-10-01T10:10:00.000Z", preview: "Resolved by support", archived: true,
    searchText: "Visitor discounted price",
  }]);
  assert.equal(entry.kind, "mixed");
  assert.equal(entry.handoffId, "handoff-1");
  assert.equal(entry.status, "resolved");
  assert.equal(entry.archived, true);
  assert.equal(entry.searchText.includes("discounted price"), true);
});

test("unlinked handoffs remain distinct and filters use real fields", () => {
  const entries = mergeLinkedHandoffs([{ ...ai }], [{
    id: "handoff-only", kind: "handoff", title: "Refund", customer: "Visitor", status: "open",
    firstActivityAt: ai.firstActivityAt, lastActivityAt: ai.lastActivityAt, preview: "Refund question",
    archived: false, searchText: "Visitor refund", conversationId: "unmatched",
  }]);
  assert.equal(entries.length, 2);
  assert.equal(filterHistoryEntries(entries, { search: "visitor", kind: "handoff", status: "open" }).length, 1);
  assert.equal(filterHistoryEntries(entries, { from: "2026-10-02" }).length, 0);
  assert.equal(filterHistoryEntries(entries, { archived: "active" }).length, 2);
});

test("history pagination is bounded and returns total count", () => {
  const page = paginateHistoryEntries([1, 2, 3, 4], 1, 2);
  assert.deepEqual(page.items, [3, 4]);
  assert.equal(page.total, 4);
});
