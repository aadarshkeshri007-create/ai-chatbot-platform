/**
 * Inactivity-based retention for anonymous widget conversations.
 *
 * A conversation is resumable while its `updated_at` (bumped on every persisted
 * chat turn) is within the retention window. Expiry is a server-side decision:
 * expired conversations are detached from their visitor session (history is
 * retained, not deleted) so they can never be resumed again. This is a
 * resumability policy, not a promise of physical erasure at a precise moment.
 */
export const DEFAULT_WIDGET_RETENTION_DAYS = 30;
export const MIN_WIDGET_RETENTION_DAYS = 1;
export const MAX_WIDGET_RETENTION_DAYS = 365;

const MS_PER_DAY = 86_400_000;

/**
 * Resolve the configured retention (days) from an environment-style value.
 * Missing, non-integer or out-of-range values fall back to the 30-day default
 * rather than silently disabling or extending retention.
 */
export function resolveWidgetRetentionDays(raw: string | undefined | null): number {
  if (typeof raw !== "string" || !/^[0-9]{1,4}$/.test(raw.trim())) return DEFAULT_WIDGET_RETENTION_DAYS;
  const days = Number(raw.trim());
  if (days < MIN_WIDGET_RETENTION_DAYS || days > MAX_WIDGET_RETENTION_DAYS) return DEFAULT_WIDGET_RETENTION_DAYS;
  return days;
}

/** Conversations last active before this instant are expired. */
export function widgetRetentionCutoff(now: Date, retentionDays: number): Date {
  return new Date(now.getTime() - retentionDays * MS_PER_DAY);
}

export function isWidgetConversationExpired(
  lastActivity: string | Date,
  now: Date,
  retentionDays: number,
): boolean {
  const last = lastActivity instanceof Date ? lastActivity : new Date(lastActivity);
  if (Number.isNaN(last.getTime())) return true;
  return last.getTime() < widgetRetentionCutoff(now, retentionDays).getTime();
}
