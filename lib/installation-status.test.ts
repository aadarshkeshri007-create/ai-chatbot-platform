import assert from "node:assert/strict";
import test from "node:test";
import {
  getInstallationStatusFailure,
  getSafeInstallationStatusError,
  parseInstallationStatus,
} from "./installation-status.ts";

test("status responses must match the installation checks contract", () => {
  const valid = {
    checks: [{
      id: "3ae0f88c-d618-497a-9286-f3571a99612c",
      expected_origin: "https://support.example",
      status: "verified",
      created_at: "2026-10-19T10:00:00.000Z",
      expires_at: "2026-10-19T10:10:00.000Z",
      verified_at: "2026-10-19T10:01:00.000Z",
    }],
    verified: true,
  };
  assert.deepEqual(parseInstallationStatus(valid), valid);
  assert.equal(parseInstallationStatus({ checks: [{ ...valid.checks[0], id: undefined }], verified: true }), null);
  assert.equal(parseInstallationStatus({ checks: "", verified: false }), null);
  assert.equal(parseInstallationStatus({ checks: [{ ...valid.checks[0], status: "unknown" }], verified: false }), null);
  assert.equal(parseInstallationStatus(null), null);
});

test("missing installation schema gets a safe migration diagnostic", () => {
  for (const code of ["42P01", "42703", "PGRST204", "PGRST205"]) {
    const failure = getInstallationStatusFailure(code);
    assert.equal(failure.code, "INSTALLATION_MIGRATION_REQUIRED");
    assert.match(failure.error, /20261019110000_add_widget_brand_and_installation_checks\.sql/);
  }
  assert.equal(getInstallationStatusFailure("XX000").code, "INSTALLATION_STATUS_UNAVAILABLE");
  assert.equal(getSafeInstallationStatusError({ error: "private database details" }), null);
});
