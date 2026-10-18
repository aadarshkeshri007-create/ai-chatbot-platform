import assert from "node:assert/strict";
import test from "node:test";

import {
  getConfiguredPublicChatOrigins,
  hasDisallowedPublicChatOrigin,
  publicChatJson,
  publicChatOptions,
  withPublicChatCors,
} from "./public-chat-cors.ts";
import {
  getAllowedPublicChatOrigin,
  isAllowedAssistantOrigin,
  normalizeAllowedDomainInput,
} from "./public-chat-origin.ts";

test("allows an exact configured assistant hostname", () => {
  assert.equal(
    isAllowedAssistantOrigin("https://customer.example", ["customer.example"]),
    true,
  );
});

test("rejects a disallowed assistant hostname", () => {
  assert.equal(
    isAllowedAssistantOrigin("https://other.example", ["customer.example"]),
    false,
  );
});

test("only adds CORS for an origin allowed by both global and assistant lists", () => {
  const configured = new Set(["https://customer.example"]);
  assert.equal(
    getAllowedPublicChatOrigin(
      "https://customer.example",
      "https://support.example/api/public/chat",
      configured,
      ["customer.example"],
    ),
    "https://customer.example",
  );
  assert.equal(
    getAllowedPublicChatOrigin(
      "https://other.example",
      "https://support.example/api/public/chat",
      configured,
      ["customer.example"],
    ),
    null,
  );
});

test("rejects malicious lookalike hostnames", () => {
  assert.equal(
    isAllowedAssistantOrigin("https://evil-customer.example", ["customer.example"]),
    false,
  );
});

test("rejects a missing Origin when assistant domains are configured", () => {
  assert.equal(isAllowedAssistantOrigin(null, ["customer.example"]), false);
});

test("empty or null assistant domains preserve global-origin behavior", () => {
  assert.equal(isAllowedAssistantOrigin("https://other.example", []), true);
  assert.equal(isAllowedAssistantOrigin("https://other.example", null), true);
});

test("normalizes valid hostnames and rejects URL-like or duplicate-prone inputs", () => {
  assert.equal(normalizeAllowedDomainInput(" Support.Example.com. "), "support.example.com");
  assert.equal(normalizeAllowedDomainInput("https://support.example.com"), null);
  assert.equal(normalizeAllowedDomainInput("support.example.com/path"), null);
  assert.equal(normalizeAllowedDomainInput("user@support.example.com"), null);
  assert.equal(normalizeAllowedDomainInput("*.example.com"), null);
  assert.equal(normalizeAllowedDomainInput("evil-example.com"), "evil-example.com");
});

test("preflight retains global CORS behavior", () => {
  const configured = new Set(["https://customer.example"]);
  assert.equal(
    getAllowedPublicChatOrigin(
      "https://customer.example",
      "https://support.example/api/public/chat",
      configured,
    ),
    "https://customer.example",
  );
  assert.equal(
    getAllowedPublicChatOrigin(
      "https://other.example",
      "https://support.example/api/public/chat",
      configured,
    ),
    null,
  );
});

test("allows only the exact local widget demo origin in development", () => {
  const configured = new Set(["http://127.0.0.1:5500"]);
  assert.equal(
    getAllowedPublicChatOrigin(
      "http://127.0.0.1:5500",
      "http://localhost:3000/api/public/chat",
      configured,
    ),
    "http://127.0.0.1:5500",
  );
  assert.equal(
    getAllowedPublicChatOrigin(
      "http://localhost:5500",
      "http://localhost:3000/api/public/chat",
      configured,
    ),
    null,
  );
});

test("getConfiguredPublicChatOrigins parses origins and respects environments", () => {
  const devOrigins = getConfiguredPublicChatOrigins("http://localhost:8080", "development");
  assert.ok(devOrigins.has("http://localhost:8080"));
  assert.ok(devOrigins.has("http://127.0.0.1:5500"));

  const prodOrigins = getConfiguredPublicChatOrigins("http://localhost:8080", "production");
  assert.ok(prodOrigins.has("http://localhost:8080"));
  assert.equal(prodOrigins.has("http://127.0.0.1:5500"), false);

  const prodWithDemo = getConfiguredPublicChatOrigins(
    "http://localhost:8080, http://127.0.0.1:5500",
    "production",
  );
  assert.ok(prodWithDemo.has("http://localhost:8080"));
  assert.ok(prodWithDemo.has("http://127.0.0.1:5500"));

  const quotedAndDirty = getConfiguredPublicChatOrigins(
    ' "http://127.0.0.1:5500" , \'https://demo.example\' , not-a-url ',
    "production",
  );
  assert.ok(quotedAndDirty.has("http://127.0.0.1:5500"));
  assert.ok(quotedAndDirty.has("https://demo.example"));
  assert.equal(quotedAndDirty.has("not-a-url"), false);
});

test("OPTIONS preflight returns 204 with required CORS headers for allowed origins", () => {
  const previousEnv = process.env.PUBLIC_CHAT_ALLOWED_ORIGINS;
  process.env.PUBLIC_CHAT_ALLOWED_ORIGINS = "http://127.0.0.1:5500";
  try {
    const request = new Request("https://supportai.example/api/public/chat", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:5500",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });

    assert.equal(hasDisallowedPublicChatOrigin(request), false);
    const response = publicChatOptions(request);

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "http://127.0.0.1:5500");
    assert.equal(response.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
    assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Content-Type");
    assert.equal(response.headers.get("Access-Control-Max-Age"), "86400");
    assert.equal(response.headers.get("Vary"), "Origin");
  } finally {
    process.env.PUBLIC_CHAT_ALLOWED_ORIGINS = previousEnv;
  }
});

test("OPTIONS preflight rejects unapproved origins without Access-Control-Allow-Origin", () => {
  const previousEnv = process.env.PUBLIC_CHAT_ALLOWED_ORIGINS;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.PUBLIC_CHAT_ALLOWED_ORIGINS = "https://approved.example";
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  try {
    const request = new Request("https://supportai.example/api/public/chat", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:5500",
        "Access-Control-Request-Method": "POST",
      },
    });

    assert.equal(hasDisallowedPublicChatOrigin(request), true);
    // Simulating what the route does when disallowed:
    const errorResponse = publicChatJson(request, { error: "Origin is not allowed." }, { status: 403 });

    assert.equal(errorResponse.status, 403);
    assert.equal(errorResponse.headers.get("Access-Control-Allow-Origin"), null);
    assert.equal(errorResponse.headers.get("Vary"), "Origin");
  } finally {
    process.env.PUBLIC_CHAT_ALLOWED_ORIGINS = previousEnv;
    (process.env as Record<string, string | undefined>).NODE_ENV = previousNodeEnv;
  }
});

test("OPTIONS preflight without Origin returns 204 and does not set Access-Control-Allow-Origin", () => {
  const request = new Request("https://supportai.example/api/public/chat", {
    method: "OPTIONS",
  });
  assert.equal(hasDisallowedPublicChatOrigin(request), false);
  const response = publicChatOptions(request);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal(response.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Content-Type");
  assert.equal(response.headers.get("Vary"), "Origin");
});

test("POST responses include exact matching CORS headers for allowed origins across statuses", async () => {
  const previousEnv = process.env.PUBLIC_CHAT_ALLOWED_ORIGINS;
  process.env.PUBLIC_CHAT_ALLOWED_ORIGINS = "http://127.0.0.1:5500,https://customer.example";
  try {
    const origin = "http://127.0.0.1:5500";
    const request = new Request("https://supportai.example/api/public/chat", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
      },
    });

    // 200 Success
    const successRes = publicChatJson(
      request,
      { response: "Hello!", sources: [] },
      { status: 200 },
      ["127.0.0.1"],
    );
    assert.equal(successRes.status, 200);
    assert.equal(successRes.headers.get("Access-Control-Allow-Origin"), origin);
    assert.equal(successRes.headers.get("Vary"), "Origin");

    // 400 Bad Request
    const badReqRes = publicChatJson(request, { error: "Message is required." }, { status: 400 });
    assert.equal(badReqRes.status, 400);
    assert.equal(badReqRes.headers.get("Access-Control-Allow-Origin"), origin);
    assert.equal(badReqRes.headers.get("Vary"), "Origin");

    // 413 Payload Too Large
    const largeRes = publicChatJson(request, { error: "Request is too large." }, { status: 413 });
    assert.equal(largeRes.status, 413);
    assert.equal(largeRes.headers.get("Access-Control-Allow-Origin"), origin);
    assert.equal(largeRes.headers.get("Vary"), "Origin");

    // 404 Not Found
    const notFoundRes = publicChatJson(request, { error: "Assistant not found." }, { status: 404 });
    assert.equal(notFoundRes.status, 404);
    assert.equal(notFoundRes.headers.get("Access-Control-Allow-Origin"), origin);

    // 503 Service Unavailable
    const serviceUnavailRes = publicChatJson(
      request,
      { error: "Service temporarily unavailable." },
      { status: 503 },
    );
    assert.equal(serviceUnavailRes.status, 503);
    assert.equal(serviceUnavailRes.headers.get("Access-Control-Allow-Origin"), origin);

    // 429 Rate limited with Retry-After exposure
    const rateLimitedRes = publicChatJson(
      request,
      { error: "Too many requests." },
      { status: 429 },
    );
    rateLimitedRes.headers.set("Retry-After", "30");
    withPublicChatCors(request, rateLimitedRes);
    assert.equal(rateLimitedRes.status, 429);
    assert.equal(rateLimitedRes.headers.get("Access-Control-Allow-Origin"), origin);
    assert.equal(rateLimitedRes.headers.get("Access-Control-Expose-Headers"), "Retry-After");
    assert.equal(rateLimitedRes.headers.get("Retry-After"), "30");
  } finally {
    process.env.PUBLIC_CHAT_ALLOWED_ORIGINS = previousEnv;
  }
});

test("POST response isolates assistants with restricted Allowed Domains", () => {
  const previousEnv = process.env.PUBLIC_CHAT_ALLOWED_ORIGINS;
  process.env.PUBLIC_CHAT_ALLOWED_ORIGINS = "http://127.0.0.1:5500,https://other.example";
  try {
    const request = new Request("https://supportai.example/api/public/chat", {
      method: "POST",
      headers: {
        Origin: "http://127.0.0.1:5500",
        "Content-Type": "application/json",
      },
    });

    // Assistant restricted to only "other.example", not "127.0.0.1"
    const restrictedRes = publicChatJson(
      request,
      { error: "Origin is not allowed for this assistant." },
      { status: 403 },
      ["other.example"],
    );
    assert.equal(restrictedRes.status, 403);
    // Origin must NOT be allowed
    assert.equal(restrictedRes.headers.get("Access-Control-Allow-Origin"), null);
    assert.equal(restrictedRes.headers.get("Vary"), "Origin");
  } finally {
    process.env.PUBLIC_CHAT_ALLOWED_ORIGINS = previousEnv;
  }
});
