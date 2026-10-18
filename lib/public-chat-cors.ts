import {
  getAllowedPublicChatOrigin,
  isAllowedAssistantOrigin as isAllowedAssistantOriginValue,
} from "./public-chat-origin.ts";

export function getConfiguredPublicChatOrigins(
  envAllowedOrigins = process.env.PUBLIC_CHAT_ALLOWED_ORIGINS,
  nodeEnv = process.env.NODE_ENV,
): Set<string> {
  const origins = new Set(
    (envAllowedOrigins ?? "")
      .split(",")
      .map((origin) => origin.trim().replace(/^["']|["']$/g, ""))
      .map((origin) => {
        try {
          return new URL(origin).origin;
        } catch {
          return "";
        }
      })
      .filter(Boolean),
  );
  if (nodeEnv !== "production") {
    origins.add("http://127.0.0.1:5500");
  }
  return origins;
}

function configuredOrigins(): Set<string> {
  return getConfiguredPublicChatOrigins();
}

export function isAllowedAssistantOrigin(
  request: Request,
  allowedDomains: string[] | null | undefined,
): boolean {
  return isAllowedAssistantOriginValue(request.headers.get("origin"), allowedDomains);
}

export function getPublicChatCorsOrigin(
  request: Request,
  allowedDomains?: string[] | null,
): string | null {
  return getAllowedPublicChatOrigin(
    request.headers.get("origin"),
    request.url,
    configuredOrigins(),
    allowedDomains,
  );
}

export function hasDisallowedPublicChatOrigin(
  request: Request,
  allowedDomains?: string[] | null,
): boolean {
  return Boolean(request.headers.get("origin")) && !getPublicChatCorsOrigin(request, allowedDomains);
}

export function withPublicChatCors<T extends Response>(
  request: Request,
  response: T,
  allowedDomains?: string[] | null,
): T {
  const origin = getPublicChatCorsOrigin(request, allowedDomains);
  const currentVary = response.headers.get("Vary");
  if (!currentVary) {
    response.headers.set("Vary", "Origin");
  } else {
    const varyTokens = currentVary.split(",").map((token) => token.trim().toLowerCase());
    if (!varyTokens.includes("origin")) {
      response.headers.set("Vary", `${currentVary}, Origin`);
    }
  }

  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    if (response.headers.has("Retry-After")) {
      response.headers.set("Access-Control-Expose-Headers", "Retry-After");
    }
  }

  return response;
}

export function publicChatJson(
  request: Request,
  body: unknown,
  init?: ResponseInit,
  allowedDomains?: string[] | null,
): Response {
  return withPublicChatCors(request, Response.json(body, init), allowedDomains);
}

export function publicChatOptions(
  request: Request,
  methods = "POST, OPTIONS",
): Response {
  const response = new Response(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Methods", methods);
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Max-Age", "86400");
  return withPublicChatCors(request, response);
}
