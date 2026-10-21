export const VALID_HANDOFF_STATUSES = [
  "open",
  "in_progress",
  "waiting_for_customer",
  "resolved",
] as const;

export type HandoffStatus = (typeof VALID_HANDOFF_STATUSES)[number];

const STATUS_SET = new Set<string>(VALID_HANDOFF_STATUSES);

export function isValidHandoffStatus(status: unknown): status is HandoffStatus {
  return typeof status === "string" && STATUS_SET.has(status);
}

/** Resolved requests are terminal because the visitor's access token is cleared. */
export function isValidHandoffTransition(current: unknown, next: unknown): next is HandoffStatus {
  return isValidHandoffStatus(current) &&
    isValidHandoffStatus(next) &&
    (current !== "resolved" || next === "resolved");
}

export function canArchiveHandoff(status: unknown): boolean {
  return status === "resolved";
}

export type HandoffPollOutcome = "resolved" | "active" | "unavailable" | "ignore";

export function getHandoffPollOutcome(input: {
  ok: boolean;
  status?: unknown;
  httpStatus?: number;
}): HandoffPollOutcome {
  if (input.ok && input.status === "resolved") return "resolved";
  if (input.ok && isValidHandoffStatus(input.status)) return "active";
  if (!input.ok && input.httpStatus === 404) return "unavailable";
  return "ignore";
}

export type ResolutionAuthResult<U, H> =
  | { authorized: true; user: U; handoff: H }
  | { authorized: false; status: 401 | 404; error: string };

/**
 * Authorize a handoff update request.
 * - If user is unauthenticated, reject with 401 Unauthorized.
 * - If the handoff does not exist or does not belong to the user, reject with 404 Not Found
 *   to avoid leaking the existence of other tenants' handoffs.
 */
export function authorizeHandoffUpdate<
  U extends { id: string },
  H extends { id: string; owner_user_id?: string },
>(
  user: U | null,
  handoff: H | null,
): ResolutionAuthResult<U, H> {
  if (!user) {
    return { authorized: false, status: 401, error: "Unauthorized" };
  }
  if (!handoff || (handoff.owner_user_id !== undefined && handoff.owner_user_id !== user.id)) {
    return { authorized: false, status: 404, error: "Support request not found." };
  }
  return { authorized: true, user, handoff };
}
