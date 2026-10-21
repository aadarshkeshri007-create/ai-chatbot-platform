import { createHash, randomBytes } from "node:crypto";

export const INSTALLATION_CHALLENGE_TTL_MS = 10 * 60 * 1000;
export const INSTALLATION_VERIFY_PATH = "/api/public/widget-installation/verify";

export function isPublicInstallationVerificationRequest(method: string, pathname: string): boolean {
  return pathname === INSTALLATION_VERIFY_PATH &&
    (method === "POST" || method === "OPTIONS");
}

export function createInstallationChallenge(now = Date.now()) {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(now + INSTALLATION_CHALLENGE_TTL_MS).toISOString(),
  };
}

export function hashInstallationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isInstallationChallengeValid(input: {
  expectedOrigin: string;
  actualOrigin: string | null;
  expiresAt: string;
  now?: number;
}): boolean {
  const expiresAt = Date.parse(input.expiresAt);
  return input.actualOrigin === input.expectedOrigin &&
    Number.isFinite(expiresAt) && expiresAt > (input.now ?? Date.now());
}

export type InstallationChallengeValidation =
  | "valid"
  | "expired"
  | "wrong_origin"
  | "wrong_assistant"
  | "already_used"
  | "invalid_token";

export function validateInstallationChallenge(input: {
  assistantId: string;
  challengeAssistantId: string;
  token: string;
  tokenHash: string;
  status: string;
  expectedOrigin: string;
  actualOrigin: string | null;
  expiresAt: string;
  now?: number;
}): InstallationChallengeValidation {
  if (hashInstallationToken(input.token) !== input.tokenHash) return "invalid_token";
  if (input.assistantId !== input.challengeAssistantId) return "wrong_assistant";
  if (input.actualOrigin !== input.expectedOrigin) return "wrong_origin";
  const expiry = Date.parse(input.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= (input.now ?? Date.now())) return "expired";
  if (input.status !== "pending") return "already_used";
  return "valid";
}

export type PersistInstallationVerification = "updated" | "conflict" | "error";
export type CompleteInstallationVerificationResult =
  | "verified"
  | "not_found"
  | "expired"
  | "wrong_origin"
  | "wrong_assistant"
  | "already_used"
  | "unavailable";

/** Validate one lookup result, then rely on an atomic pending-to-verified update. */
export async function completeInstallationVerification(input: {
  challenge: {
    id: string;
    assistant_id: string;
    token_hash: string;
    expected_origin: string;
    expires_at: string;
    status: string;
  } | null;
  assistantId: string;
  token: string;
  actualOrigin: string | null;
  now?: number;
  persist: (challengeId: string, now: string) => Promise<PersistInstallationVerification>;
}): Promise<CompleteInstallationVerificationResult> {
  const challenge = input.challenge;
  if (!challenge) return "not_found";

  const validation = validateInstallationChallenge({
    assistantId: input.assistantId,
    challengeAssistantId: challenge.assistant_id,
    token: input.token,
    tokenHash: challenge.token_hash,
    status: challenge.status,
    expectedOrigin: challenge.expected_origin,
    actualOrigin: input.actualOrigin,
    expiresAt: challenge.expires_at,
    now: input.now,
  });
  if (validation !== "valid") {
    if (validation === "invalid_token") return "not_found";
    return validation;
  }

  const now = input.now ?? Date.now();
  let persistence: PersistInstallationVerification;
  try {
    persistence = await input.persist(challenge.id, new Date(now).toISOString());
  } catch {
    return "unavailable";
  }
  if (persistence === "error") return "unavailable";
  if (persistence === "updated") return "verified";
  return Date.parse(challenge.expires_at) <= Date.now() ? "expired" : "already_used";
}

/** Kept self-contained so the exact predicate can be embedded in widget.js. */
export function isVerificationConfigReady(config: unknown): boolean {
  if (typeof config !== "object" || config === null || Array.isArray(config)) return false;
  const candidate = config as Record<string, unknown>;
  return typeof candidate.brand_color === "string" && /^#[0-9a-f]{6}$/i.test(candidate.brand_color) &&
    typeof candidate.brand_text_color === "string" && /^#[0-9a-f]{6}$/i.test(candidate.brand_text_color) &&
    typeof candidate.brand_link_color === "string" && /^#[0-9a-f]{6}$/i.test(candidate.brand_link_color);
}
