import assert from "node:assert/strict";
import test from "node:test";
import {
  createPublicAssistantConfigHandlers,
  isPublicAssistantConfigRequest,
} from "./public-assistant-config.ts";

const allowedOrigin = "http://127.0.0.1:5500";
const assistantId = "73df06ca-95c0-41e1-b160-d569f3864291";
const apiUrl = `http://localhost:3000/api/public/assistant-config?assistant_id=${assistantId}`;
const originalAllowedOrigins = process.env.PUBLIC_CHAT_ALLOWED_ORIGINS;
test.after(() => {
  if (originalAllowedOrigins === undefined) delete process.env.PUBLIC_CHAT_ALLOWED_ORIGINS;
  else process.env.PUBLIC_CHAT_ALLOWED_ORIGINS = originalAllowedOrigins;
});

function withAllowedOrigin(request: Request) {
  process.env.PUBLIC_CHAT_ALLOWED_ORIGINS = allowedOrigin;
  return request;
}

test("public assistant config bypasses login only for its GET and OPTIONS route", () => {
  assert.equal(isPublicAssistantConfigRequest("GET", "/api/public/assistant-config"), true);
  assert.equal(isPublicAssistantConfigRequest("OPTIONS", "/api/public/assistant-config"), true);
  assert.equal(isPublicAssistantConfigRequest("GET", "/settings"), false);
  assert.equal(isPublicAssistantConfigRequest("POST", "/api/public/assistant-config"), false);
  assert.equal(isPublicAssistantConfigRequest("GET", "/api/public/assistant-config/extra"), false);
});

test("allowed origin and valid assistant return only public branding with exact CORS", async () => {
  const handlers = createPublicAssistantConfigHandlers(async (requestedId) => {
    assert.equal(requestedId, assistantId);
    return { data: { brand_color: "#12abef", allowed_domains: ["127.0.0.1"], handoff_enabled: false, handoff_intro: "Ask our team for a reply." } };
  });
  const response = await handlers.GET(withAllowedOrigin(new Request(apiUrl, {
    headers: { origin: allowedOrigin },
  })));
  assert.equal(response.status, 200);
  assert.equal(response.redirected, false);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.equal(response.headers.get("vary"), "Origin");
  assert.deepEqual(await response.json(), {
    brand_color: "#12abef",
    brand_text_color: "#111827",
    brand_link_color: "#334155",
    handoff_enabled: false,
    handoff_intro: "Ask our team for a reply.",
  });
});

test("allowed origin preflight and service failures retain safe CORS responses", async () => {
  const handlers = createPublicAssistantConfigHandlers(async () => ({
    data: null,
    error: { message: "private database detail" },
  }));
  const preflight = await handlers.OPTIONS(withAllowedOrigin(new Request(apiUrl, {
    method: "OPTIONS",
    headers: { origin: allowedOrigin },
  })));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.equal(preflight.headers.get("access-control-allow-methods"), "GET, OPTIONS");

  const response = await handlers.GET(withAllowedOrigin(new Request(apiUrl, {
    headers: { origin: allowedOrigin },
  })));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.deepEqual(await response.json(), { error: "Assistant configuration is unavailable." });
});

test("disallowed global and assistant origins cannot retrieve assistant config", async () => {
  const handlers = createPublicAssistantConfigHandlers(async () => ({
    data: { brand_color: "#236b5b", allowed_domains: ["127.0.0.1"] },
  }));
  const globallyDisallowed = await handlers.GET(new Request(apiUrl, {
    headers: { origin: "https://attacker.example" },
  }));
  assert.equal(globallyDisallowed.status, 403);
  assert.equal(globallyDisallowed.headers.has("access-control-allow-origin"), false);

  const assistantRestricted = await handlers.GET(withAllowedOrigin(new Request(apiUrl, {
    headers: { origin: "http://localhost:3000" },
  })));
  assert.equal(assistantRestricted.status, 403);
  assert.equal(assistantRestricted.headers.has("access-control-allow-origin"), false);
});

test("missing or invalid IDs and missing assistants return safe errors with global CORS", async () => {
  const handlers = createPublicAssistantConfigHandlers(async () => ({ data: null }));
  for (const url of [
    "http://localhost:3000/api/public/assistant-config",
    "http://localhost:3000/api/public/assistant-config?assistant_id=invalid",
  ]) {
    const response = await handlers.GET(withAllowedOrigin(new Request(url, {
      headers: { origin: allowedOrigin },
    })));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  }

  const missing = await handlers.GET(withAllowedOrigin(new Request(apiUrl, {
    headers: { origin: allowedOrigin },
  })));
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.deepEqual(await missing.json(), { error: "Assistant configuration is unavailable." });
});
