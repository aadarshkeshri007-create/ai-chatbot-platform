/**
 * Handoff session helpers.
 *
 * These functions manage the browser-local handoff session that the widget
 * frame persists in localStorage.  Keeping them in a separate module makes
 * them testable without rendering the React component.
 *
 * Persistence contract
 * --------------------
 * • One localStorage key per origin: `supportai:handoff-access`
 * • Value: `{ assistantId, id, token }` written when a handoff is created.
 * • The key is removed when:
 *     – the server reports `status === "resolved"`, OR
 *     – the server returns 404 for the stored token (expired / deleted), OR
 *     – the visitor explicitly resets their local demo session.
 * • Clearing this key does NOT delete or alter any server-side record.
 */

export const HANDOFF_ACCESS_STORAGE_KEY = "supportai:handoff-access";

export type HandoffAccess = { id: string; token: string };

/**
 * Write a new handoff session to localStorage, scoped to assistantId.
 * Safe to call on every successful handoff creation.
 */
export function saveHandoffAccess(
  assistantId: string,
  access: HandoffAccess,
  storage: Storage = localStorage,
): void {
  storage.setItem(
    HANDOFF_ACCESS_STORAGE_KEY,
    JSON.stringify({ assistantId, ...access }),
  );
}

/**
 * Read the stored handoff access for a specific assistant, validating shape.
 * Returns null if nothing is stored, if the stored entry belongs to a
 * different assistant, or if the stored value is malformed.
 */
export function readHandoffAccess(
  assistantId: string,
  storage: Storage = localStorage,
): HandoffAccess | null {
  try {
    const raw = storage.getItem(HANDOFF_ACCESS_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as {
      assistantId?: unknown;
      id?: unknown;
      token?: unknown;
    };
    return saved?.assistantId === assistantId &&
      typeof saved.id === "string" &&
      typeof saved.token === "string"
      ? { id: saved.id, token: saved.token }
      : null;
  } catch {
    storage.removeItem(HANDOFF_ACCESS_STORAGE_KEY);
    return null;
  }
}

/**
 * Remove the stored handoff session from localStorage.
 *
 * This only clears the browser-local token; it does NOT modify the
 * handoff_requests row in the database.  The server record remains
 * accessible through the owner's dashboard.
 */
export function clearHandoffAccess(storage: Storage = localStorage): void {
  storage.removeItem(HANDOFF_ACCESS_STORAGE_KEY);
}

/**
 * Return true when the parsed handoff status from the server means the
 * browser should treat the session as finished and remove the local token.
 *
 * "resolved" is the normal terminal state set by the owner.
 * "not_found" signals that the token is invalid / expired, which also ends
 * the session from the visitor's perspective.
 */
export function isHandoffSessionTerminated(
  status: string | null | undefined,
): boolean {
  return status === "resolved";
}
