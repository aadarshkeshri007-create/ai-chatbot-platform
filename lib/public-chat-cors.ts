import { NextResponse } from "next/server";

function configuredOrigins(): Set<string> {
  return new Set(
    (process.env.PUBLIC_CHAT_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin && origin !== "*"),
  );
}

export function getPublicChatCorsOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    return null;
  }

  if (origin === requestOrigin || configuredOrigins().has(origin)) {
    return origin;
  }

  return null;
}

export function hasDisallowedPublicChatOrigin(request: Request): boolean {
  return Boolean(request.headers.get("origin")) && !getPublicChatCorsOrigin(request);
}

export function withPublicChatCors(
  request: Request,
  response: NextResponse,
): NextResponse {
  const origin = getPublicChatCorsOrigin(request);
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
): NextResponse {
  return withPublicChatCors(request, NextResponse.json(body, init));
}

export function publicChatOptions(request: Request): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return withPublicChatCors(request, response);
}
