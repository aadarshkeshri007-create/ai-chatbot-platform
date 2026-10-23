export function normalizeHostname(value: string): string | null {
  const trimmed = value.trim().toLowerCase().replace(/\.+$/, "");
  if (!trimmed || trimmed.includes("/") || trimmed.includes("@")) return null;

  try {
    const parsed = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`,
    );
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return parsed.hostname.replace(/\.+$/, "");
  } catch {
    return null;
  }
}

export function normalizeAllowedDomainInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /\s|\*|%|\\/.test(trimmed) || trimmed.includes("@")) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username || parsed.password) return null;
    const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, "");
    if (!hostname || hostname.includes("..") || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(hostname)) return null;
    return hostname;
  } catch {
    return null;
  }
}

export function normalizeOrigin(value: string): {
  origin: string;
  hostname: string;
} | null {
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.origin !== value
    ) {
      return null;
    }
    return {
      origin: parsed.origin,
      hostname: parsed.hostname.replace(/\.+$/, "").toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function isAllowedAssistantOrigin(
  origin: string | null,
  allowedDomains: string[] | null | undefined,
): boolean {
  const configuredDomains = (allowedDomains ?? [])
    .map(normalizeHostname)
    .filter((domain): domain is string => Boolean(domain));

  // Empty or null means no assistant-specific restriction. The global origin
  // allowlist is still enforced by getPublicChatCorsOrigin.
  if (configuredDomains.length === 0) return true;
  if (!origin) return false;

  const requested = normalizeOrigin(origin);
  return Boolean(requested && configuredDomains.includes(requested.hostname));
}

export function getAllowedPublicChatOrigin(
  origin: string | null,
  requestUrl: string,
  configuredOrigins: Set<string>,
  allowedDomains?: string[] | null,
): string | null {
  if (!origin) return null;

  const requested = normalizeOrigin(origin);
  if (!requested) return null;

  let appOrigin: string;
  try {
    appOrigin = new URL(requestUrl).origin;
  } catch {
    return null;
  }

  return (requested.origin === appOrigin || configuredOrigins.has(requested.origin)) &&
    isAllowedAssistantOrigin(origin, allowedDomains)
    ? requested.origin
    : null;
}
