import assert from "node:assert/strict";
import test from "node:test";
import {
  HANDOFF_ACCESS_STORAGE_KEY,
  clearHandoffAccess,
  isHandoffSessionTerminated,
  readHandoffAccess,
  saveHandoffAccess,
} from "./handoff-session.ts";
import {
  authorizeHandoffUpdate,
  canArchiveHandoff,
  getHandoffPollOutcome,
  isValidHandoffStatus,
  isValidHandoffTransition,
} from "./handoff-resolution.ts";

function createMockStorage(initialData: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(initialData));
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

test("active handoff persistence stores and restores session across reloads", () => {
  const storage = createMockStorage();
  const assistantId = "73df06ca-95c0-41e1-b160-d569f3864291";
  const handoff = {
    id: "6e5fa8cb-8db7-4a2f-b231-42d07de80801",
    token: "valid-secret-access-token-123",
  };

  saveHandoffAccess(assistantId, handoff, storage);

  // Raw storage verification
  const raw = storage.getItem(HANDOFF_ACCESS_STORAGE_KEY);
  assert.ok(raw);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.assistantId, assistantId);
  assert.equal(parsed.id, handoff.id);
  assert.equal(parsed.token, handoff.token);

  // First session restoration
  const restored = readHandoffAccess(assistantId, storage);
  assert.deepEqual(restored, handoff);

  // Subsequent reload restoration
  const reloaded = readHandoffAccess(assistantId, storage);
  assert.deepEqual(reloaded, handoff);
});

test("resolved handoff cleanup detects termination and prunes stored session", () => {
  const storage = createMockStorage();
  const assistantId = "73df06ca-95c0-41e1-b160-d569f3864291";

  // Check terminal vs active statuses
  assert.equal(isHandoffSessionTerminated("resolved"), true);
  assert.equal(isHandoffSessionTerminated("not_found"), false);
  assert.equal(isHandoffSessionTerminated("in_progress"), false);
  assert.equal(isHandoffSessionTerminated("open"), false);
  assert.equal(isHandoffSessionTerminated("waiting_for_customer"), false);
  assert.equal(isHandoffSessionTerminated(null), false);
  assert.equal(isHandoffSessionTerminated(undefined), false);

  // Seed storage with an active handoff
  saveHandoffAccess(
    assistantId,
    { id: "handoff-1", token: "tok-1" },
    storage,
  );
  assert.ok(readHandoffAccess(assistantId, storage));

  // Simulating resolution cleanup
  clearHandoffAccess(storage);

  // After cleanup, reloading gets null so resolved handoffs do not reappear as active
  assert.equal(storage.getItem(HANDOFF_ACCESS_STORAGE_KEY), null);
  assert.equal(readHandoffAccess(assistantId, storage), null);
});

test("only confirmed resolution ends a visitor handoff; missing polls remain unavailable", () => {
  assert.equal(getHandoffPollOutcome({ ok: true, status: "resolved" }), "resolved");
  assert.equal(getHandoffPollOutcome({ ok: true, status: "open" }), "active");
  assert.equal(getHandoffPollOutcome({ ok: true, status: "in_progress" }), "active");
  assert.equal(getHandoffPollOutcome({ ok: true, status: "waiting_for_customer" }), "active");
  assert.equal(getHandoffPollOutcome({ ok: false, httpStatus: 404 }), "unavailable");
  assert.equal(getHandoffPollOutcome({ ok: false, httpStatus: 503 }), "ignore");
  assert.equal(getHandoffPollOutcome({ ok: true, status: "not_found" }), "ignore");
});

test("resolved is terminal while all nonterminal handoff statuses can transition", () => {
  for (const current of ["open", "in_progress", "waiting_for_customer"]) {
    assert.equal(isValidHandoffTransition(current, "resolved"), true);
    assert.equal(isValidHandoffTransition(current, "waiting_for_customer"), true);
  }
  assert.equal(isValidHandoffTransition("resolved", "resolved"), true);
  assert.equal(isValidHandoffTransition("resolved", "open"), false);
  assert.equal(isValidHandoffTransition("resolved", "in_progress"), false);
  assert.equal(canArchiveHandoff("resolved"), true);
  assert.equal(canArchiveHandoff("open"), false);
  assert.equal(canArchiveHandoff("waiting_for_customer"), false);
});

test("fresh session isolation prevents handoff bleed between different assistants", () => {
  const storage = createMockStorage();
  const assistantAlpha = "11111111-1111-4111-8111-111111111111";
  const assistantBeta = "22222222-2222-4222-8222-222222222222";

  saveHandoffAccess(
    assistantAlpha,
    { id: "alpha-handoff", token: "alpha-tok" },
    storage,
  );

  // Assistant Beta must be completely fresh and isolated
  assert.equal(readHandoffAccess(assistantBeta, storage), null);

  // Assistant Alpha can still access its own handoff
  assert.deepEqual(readHandoffAccess(assistantAlpha, storage), {
    id: "alpha-handoff",
    token: "alpha-tok",
  });
});

test("local session reset safety handles empty, corrupt, or repeated resets without throwing", () => {
  const storage = createMockStorage();
  const assistantId = "73df06ca-95c0-41e1-b160-d569f3864291";

  // Repeated resets on empty storage
  clearHandoffAccess(storage);
  clearHandoffAccess(storage);
  assert.equal(readHandoffAccess(assistantId, storage), null);

  // Corrupt / non-JSON stored data is safely cleared and returns null
  storage.setItem(HANDOFF_ACCESS_STORAGE_KEY, "{ not valid json %%%");
  assert.equal(readHandoffAccess(assistantId, storage), null);
  assert.equal(storage.getItem(HANDOFF_ACCESS_STORAGE_KEY), null);

  // Malformed structure (missing token or id) safely returns null
  storage.setItem(
    HANDOFF_ACCESS_STORAGE_KEY,
    JSON.stringify({ assistantId, id: 123, token: null }),
  );
  assert.equal(readHandoffAccess(assistantId, storage), null);
});

test("unauthorized handoff resolution rejection protects handoff status transitions", () => {
  const ownerUser = { id: "user-owner-uuid" };
  const attackerUser = { id: "user-attacker-uuid" };
  const handoff = { id: "handoff-123", owner_user_id: "user-owner-uuid" };

  // 1. Unauthenticated request rejected with 401
  const unauth = authorizeHandoffUpdate(null, handoff);
  assert.equal(unauth.authorized, false);
  if (!unauth.authorized) {
    assert.equal(unauth.status, 401);
    assert.equal(unauth.error, "Unauthorized");
  }

  // 2. Cross-tenant / unauthorized attacker rejected with 404 (prevent tenant enumeration)
  const crossTenant = authorizeHandoffUpdate(attackerUser, handoff);
  assert.equal(crossTenant.authorized, false);
  if (!crossTenant.authorized) {
    assert.equal(crossTenant.status, 404);
    assert.equal(crossTenant.error, "Support request not found.");
  }

  // 3. Non-existent handoff rejected with 404
  const missing = authorizeHandoffUpdate(ownerUser, null);
  assert.equal(missing.authorized, false);
  if (!missing.authorized) {
    assert.equal(missing.status, 404);
  }

  // 4. Authorized owner succeeds
  const success = authorizeHandoffUpdate(ownerUser, handoff);
  assert.equal(success.authorized, true);

  // 5. Status validation rejects invalid states
  assert.equal(isValidHandoffStatus("resolved"), true);
  assert.equal(isValidHandoffStatus("in_progress"), true);
  assert.equal(isValidHandoffStatus("open"), true);
  assert.equal(isValidHandoffStatus("waiting_for_customer"), true);
  assert.equal(isValidHandoffStatus("closed"), false);
  assert.equal(isValidHandoffStatus("deleted"), false);
  assert.equal(isValidHandoffStatus(""), false);
  assert.equal(isValidHandoffStatus(null), false);
  assert.equal(isValidHandoffStatus(123), false);
});
