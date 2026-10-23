export const PROFILE_NAME_MAX_LENGTH = 80;

export function getProfileName(
  metadata: Record<string, unknown> | null | undefined,
  email: string | null | undefined,
): string {
  const metadataName = [metadata?.full_name, metadata?.name].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  if (metadataName) return metadataName.trim().slice(0, PROFILE_NAME_MAX_LENGTH);
  return email?.split("@")[0]?.trim().slice(0, PROFILE_NAME_MAX_LENGTH) || "User";
}

export function normalizeProfileName(value: string): string | null {
  const name = value.trim();
  return name.length > 0 && name.length <= PROFILE_NAME_MAX_LENGTH ? name : null;
}
