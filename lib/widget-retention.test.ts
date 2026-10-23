import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_WIDGET_RETENTION_DAYS,
  isWidgetConversationExpired,
  resolveWidgetRetentionDays,
  widgetRetentionCutoff,
} from "./widget-retention.ts";

test("retention defaults to 30 days of inactivity", () => {
  assert.equal(DEFAULT_WIDGET_RETENTION_DAYS, 30);
  assert.equal(resolveWidgetRetentionDays(undefined), 30);
  assert.equal(resolveWidgetRetentionDays(null), 30);
  assert.equal(resolveWidgetRetentionDays(""), 30);
});

test("retention is configurable within 1-365 days and rejects unsafe values", () => {
  assert.equal(resolveWidgetRetentionDays("7"), 7);
  assert.equal(resolveWidgetRetentionDays(" 90 "), 90);
  assert.equal(resolveWidgetRetentionDays("1"), 1);
  assert.equal(resolveWidgetRetentionDays("365"), 365);
  for (const bad of ["0", "-5", "366", "99999", "abc", "1.5", "10d", "1e3", "NaN", "Infinity"]) {
    assert.equal(resolveWidgetRetentionDays(bad), 30, `value ${bad} must fall back to the default`);
  }
});

test("expiry is measured from last activity, with the exact cutoff still resumable", () => {
  const now = new Date("2026-11-20T12:00:00.000Z");
  const cutoff = widgetRetentionCutoff(now, 30);
  assert.equal(cutoff.toISOString(), "2026-10-21T12:00:00.000Z");
  assert.equal(isWidgetConversationExpired("2026-10-21T12:00:00.000Z", now, 30), false);
  assert.equal(isWidgetConversationExpired("2026-10-21T11:59:59.999Z", now, 30), true);
  assert.equal(isWidgetConversationExpired("2026-11-19T00:00:00.000Z", now, 30), false);
  assert.equal(isWidgetConversationExpired(new Date("2026-01-01T00:00:00Z"), now, 30), true);
  assert.equal(isWidgetConversationExpired("not-a-date", now, 30), true, "unparseable activity is never resumable");
});
