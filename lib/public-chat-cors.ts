import { NextResponse } from "next/server";
import {
  getAllowedPublicChatOrigin,
  isAllowedAssistantOrigin as isAllowedAssistantOriginValue,
} from "./public-chat-origin";

function configuredOrigins(): Set<string> {
  const origins = new Set(
    (process.env.PUBLIC_CHAT_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .map((origin) => {
        try {
          return new URL(origin).origin;
        } catch {
          return "";
        }
      })
      .filter(Boolean),
  );
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://127.0.0.1:5500");
  }
  return origins;
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

export function withPublicChatCors(
  request: Request,
  response: NextResponse,
  allowedDomains?: string[] | null,
): NextResponse {
  const origin = getPublicChatCorsOrigin(request, allowedDomains);
  response.headers.append("Vary", "Origin");

  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }

  return response;
}

export function publicChatJson(
  request: Request,
  body: unknown,
  init?: ResponseInit,
  allowedDomains?: string[] | null,
): NextResponse {
  return withPublicChatCors(request, NextResponse.json(body, init), allowedDomains);
}

export function publicChatOptions(
  request: Request,
  methods = "POST, OPTIONS",
): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Methods", methods);
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return withPublicChatCors(request, response);
}
