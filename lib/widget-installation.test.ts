import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createInstallationChallenge,
  completeInstallationVerification,
  hashInstallationToken,
  INSTALLATION_VERIFY_PATH,
  isPublicInstallationVerificationRequest,
  isVerificationConfigReady,
  isInstallationChallengeValid,
  validateInstallationChallenge,
} from "./widget-installation.ts";

test("installation challenges store a hash, expire, and require the exact expected origin", () => {
  const challenge = createInstallationChallenge(1_000_000);
  assert.notEqual(challenge.token, challenge.tokenHash);
  assert.equal(hashInstallationToken(challenge.token), challenge.tokenHash);
  assert.equal(isInstallationChallengeValid({
    expectedOrigin: "https://support.example",
    actualOrigin: "https://support.example",
    expiresAt: challenge.expiresAt,
    now: 1_000_001,
  }), true);
  assert.equal(isInstallationChallengeValid({
    expectedOrigin: "https://support.example",
    actualOrigin: "https://other.example",
    expiresAt: challenge.expiresAt,
    now: 1_000_001,
  }), false);
  assert.equal(isInstallationChallengeValid({
    expectedOrigin: "https://support.example",
    actualOrigin: "https://support.example",
    expiresAt: challenge.expiresAt,
    now: 1_000_000 + 10 * 60 * 1000,
  }), false);
});

test("successful challenge verification requires its assistant, token, pending state, origin, and unexpired deadline", () => {
  const now = 1_000_000;
  const challenge = createInstallationChallenge(now);
  const valid = {
    assistantId: "assistant-1",
    challengeAssistantId: "assistant-1",
    token: challenge.token,
    tokenHash: challenge.tokenHash,
    status: "pending",
    expectedOrigin: "http://127.0.0.1:5500",
    actualOrigin: "http://127.0.0.1:5500",
    expiresAt: challenge.expiresAt,
    now: now + 1,
  };
  assert.equal(validateInstallationChallenge(valid), "valid");
  assert.equal(validateInstallationChallenge({ ...valid, status: "verified" }), "already_used");
  assert.equal(validateInstallationChallenge({ ...valid, status: "expired" }), "already_used");
  assert.equal(validateInstallationChallenge({ ...valid, actualOrigin: "http://localhost:5500" }), "wrong_origin");
  assert.equal(validateInstallationChallenge({ ...valid, now: now + 10 * 60 * 1000 }), "expired");
  assert.equal(validateInstallationChallenge({ ...valid, assistantId: "assistant-2" }), "wrong_assistant");
  assert.equal(validateInstallationChallenge({ ...valid, token: `${challenge.token}x` }), "invalid_token");
});

test("a fresh pending challenge verifies once and persists verified status", async () => {
  const created = createInstallationChallenge();
  const record = {
    id: "challenge-1",
    assistant_id: "assistant-1",
    token_hash: created.tokenHash,
    expected_origin: "http://127.0.0.1:5500",
    expires_at: created.expiresAt,
    status: "pending",
  };
  const stored = { status: "pending", verifiedAt: null as string | null };
  const result = await completeInstallationVerification({
    challenge: record,
    assistantId: record.assistant_id,
    token: created.token,
    actualOrigin: record.expected_origin,
    persist: async (_id, now) => {
      if (stored.status !== "pending" || Date.parse(record.expires_at) <= Date.parse(now)) return "conflict";
      stored.status = "verified";
      stored.verifiedAt = now;
      return "updated";
    },
  });
  assert.equal(result, "verified");
  assert.equal(stored.status, "verified");
  assert.ok(stored.verifiedAt);
});

test("concurrent verification requests cannot both succeed", async () => {
  const created = createInstallationChallenge();
  const record = {
    id: "challenge-2",
    assistant_id: "assistant-1",
    token_hash: created.tokenHash,
    expected_origin: "http://127.0.0.1:5500",
    expires_at: created.expiresAt,
    status: "pending",
  };
  let status = "pending";
  const attempt = () => completeInstallationVerification({
    challenge: record,
    assistantId: record.assistant_id,
    token: created.token,
    actualOrigin: record.expected_origin,
    persist: async () => {
      if (status !== "pending") return "conflict";
      status = "verified";
      return "updated";
    },
  });
  const results = await Promise.all([attempt(), attempt()]);
  assert.deepEqual(results.sort(), ["already_used", "verified"]);
  assert.equal(status, "verified");
});

test("stale and replayed tokens are rejected without changing persisted state", async () => {
  const created = createInstallationChallenge();
  const record = {
    id: "challenge-3",
    assistant_id: "assistant-1",
    token_hash: created.tokenHash,
    expected_origin: "http://127.0.0.1:5500",
    expires_at: created.expiresAt,
    status: "verified",
  };
  let persistCalls = 0;
  const stale = await completeInstallationVerification({
    challenge: record,
    assistantId: record.assistant_id,
    token: `${created.token}stale`,
    actualOrigin: record.expected_origin,
    persist: async () => { persistCalls += 1; return "updated"; },
  });
  const replay = await completeInstallationVerification({
    challenge: record,
    assistantId: record.assistant_id,
    token: created.token,
    actualOrigin: record.expected_origin,
    persist: async () => { persistCalls += 1; return "updated"; },
  });
  assert.equal(stale, "not_found");
  assert.equal(replay, "already_used");
  assert.equal(persistCalls, 0);
  assert.equal(record.status, "verified");
});

test("configuration failures cannot pass the widget readiness gate", () => {
  assert.equal(isVerificationConfigReady(null), false);
  assert.equal(isVerificationConfigReady({ error: "unavailable" }), false);
  assert.equal(isVerificationConfigReady({
    brand_color: "#236b5b",
    brand_text_color: "#ffffff",
    brand_link_color: "#236b5b",
  }), true);
  assert.equal(isVerificationConfigReady({
    brand_color: "invalid",
    brand_text_color: "#ffffff",
    brand_link_color: "#236b5b",
  }), false);
});

test("only the public verification POST and preflight bypass the authenticated proxy", () => {
  assert.equal(INSTALLATION_VERIFY_PATH, "/api/public/widget-installation/verify");
  assert.equal(isPublicInstallationVerificationRequest("POST", INSTALLATION_VERIFY_PATH), true);
  assert.equal(isPublicInstallationVerificationRequest("OPTIONS", INSTALLATION_VERIFY_PATH), true);
  assert.equal(isPublicInstallationVerificationRequest("GET", INSTALLATION_VERIFY_PATH), false);
  assert.equal(isPublicInstallationVerificationRequest("POST", `${INSTALLATION_VERIFY_PATH}/other`), false);
});

test("local demo does not keep a stale one-use verification token", async () => {
  const demo = await readFile(new URL("../supportai-widget-test/index.html", import.meta.url), "utf8");
  assert.equal(/data-verification-token\s*=/.test(demo), false);
});
