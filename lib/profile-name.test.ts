import assert from "node:assert/strict";
import test from "node:test";
import { getProfileName, normalizeProfileName, PROFILE_NAME_MAX_LENGTH } from "./profile-name.ts";

test("profile name prefers the saved full name and falls back to the email name", () => {
  assert.equal(getProfileName({ full_name: "  Ada Lovelace " }, "ada@example.com"), "Ada Lovelace");
  assert.equal(getProfileName({}, "ada@example.com"), "ada");
  assert.equal(getProfileName(null, null), "User");
});

test("profile name normalization requires a trimmed name within the supported limit", () => {
  assert.equal(normalizeProfileName("  Ada Lovelace  "), "Ada Lovelace");
  assert.equal(normalizeProfileName("  "), null);
  assert.equal(normalizeProfileName("a".repeat(PROFILE_NAME_MAX_LENGTH + 1)), null);
});
