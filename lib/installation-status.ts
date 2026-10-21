export type InstallCheck = {
  id: string;
  expected_origin: string;
  status: "pending" | "verified" | "expired";
  created_at: string;
  expires_at: string;
  verified_at: string | null;
};

export type InstallationStatus = {
  checks: InstallCheck[];
  verified: boolean;
};

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isInstallCheck(value: unknown): value is InstallCheck {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const check = value as Record<string, unknown>;
  return typeof check.id === "string" && check.id.length > 0 &&
    typeof check.expected_origin === "string" &&
    (check.status === "pending" || check.status === "verified" || check.status === "expired") &&
    isTimestamp(check.created_at) &&
    isTimestamp(check.expires_at) &&
    (check.verified_at === null || isTimestamp(check.verified_at));
}

export function parseInstallationStatus(value: unknown): InstallationStatus | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const response = value as Record<string, unknown>;
  if (!Array.isArray(response.checks) || !response.checks.every(isInstallCheck) || typeof response.verified !== "boolean") {
    return null;
  }
  return { checks: response.checks, verified: response.verified };
}

export function getInstallationStatusFailure(code: string | null | undefined) {
  if (["42P01", "42703", "PGRST204", "PGRST205"].includes(code ?? "")) {
    return {
      code: "INSTALLATION_MIGRATION_REQUIRED",
      error: "Installation tracking is unavailable. Apply Supabase migration 20261019110000_add_widget_brand_and_installation_checks.sql. If it is already applied, refresh the Supabase API schema cache.",
    };
  }
  return {
    code: "INSTALLATION_STATUS_UNAVAILABLE",
    error: "Unable to load installation checks right now. Please retry.",
  };
}

export function getSafeInstallationStatusError(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const response = value as Record<string, unknown>;
  if (response.code === "INSTALLATION_MIGRATION_REQUIRED") {
    return "Installation tracking is unavailable. Apply Supabase migration 20261019110000_add_widget_brand_and_installation_checks.sql. If it is already applied, refresh the Supabase API schema cache.";
  }
  if (response.code === "UNAUTHORIZED") return "Your session has expired. Sign in again, then retry.";
  if (response.code === "ASSISTANT_NOT_AVAILABLE") return "Your Assistant ID is not available yet. Reload this page after your assistant is set up.";
  if (response.code === "INSTALLATION_STATUS_UNAVAILABLE") return "Unable to load installation checks right now. Please retry.";
  return null;
}
