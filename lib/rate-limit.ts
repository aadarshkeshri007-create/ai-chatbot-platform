import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Server-only rate limiting utility for SupportAI public endpoints.
 *
 * Scopes limits by (assistant_id, client_ip) to ensure multi-tenant isolation.
 * Connects to Upstash Redis using UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
 *
 * This module must never be imported in client components.
 */

export type RateLimitResult =
  | { status: "allowed" }
  | { status: "rate_limited"; retryAfter?: number }
  | { status: "service_unavailable" };

let publicChatLimiterInstance: Ratelimit | null = null;

function normalizeIp(ip: string): string {
  let cleaned = ip.trim().toLowerCase();

  // Strip IPv4 port if formatted as 192.0.2.1:1234
  if (/^(\d{1,3}\.){3}\d{1,3}:\d+$/.test(cleaned)) {
    cleaned = cleaned.split(":")[0];
  }

  // Strip bracketed IPv6 port if formatted as [2001:db8::1]:1234
  if (cleaned.startsWith("[") && cleaned.includes("]:")) {
    cleaned = cleaned.substring(1, cleaned.indexOf("]:"));
  }

  return cleaned || "no-ip-header";
}

/**
 * Extracts and normalizes the client IP address from request headers.
 * Prioritizes trusted edge headers (Vercel) before falling back.
 */
export function getClientIp(request: Request): string {
  // On Vercel, x-vercel-forwarded-for is populated and sanitized by the edge network
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    const first = vercelForwardedFor.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    const trimmed = realIp.trim();
    if (trimmed) return normalizeIp(trimmed);
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }

  return "no-ip-header";
}

/**
 * Initializes and returns a cached Ratelimit instance for the Next.js runtime.
 * Returns null if the required Upstash environment variables are not configured.
 */
function getPublicChatLimiter(): Ratelimit | null {
  if (publicChatLimiterInstance) {
    return publicChatLimiterInstance;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.error("Upstash Redis configuration is missing.");
    return null;
  }

  const redis = new Redis({
    url,
    token,
  });

  publicChatLimiterInstance = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "10 s"),
    prefix: "supportai:ratelimit:public_chat",
  });

  return publicChatLimiterInstance;
}

/**
 * Evaluates the public chat rate limit for a specific assistant and client IP.
 * Fails closed if Redis is unavailable or unconfigured.
 */
export async function checkPublicChatRateLimit(
  request: Request,
  assistantId: string,
): Promise<RateLimitResult> {
  const limiter = getPublicChatLimiter();
  if (!limiter) {
    return { status: "service_unavailable" };
  }

  const clientIp = getClientIp(request);
  const identifier = `${assistantId}:${clientIp}`;

  try {
    const result = await limiter.limit(identifier);

    if (result.success) {
      return { status: "allowed" };
    }

    const retryAfter = result.reset
      ? Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
      : undefined;

    return { status: "rate_limited", retryAfter };
  } catch {
    console.error("Public chat rate limit check failed.");
    return { status: "service_unavailable" };
  }
}
