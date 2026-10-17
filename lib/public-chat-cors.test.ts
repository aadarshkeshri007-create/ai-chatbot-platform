import assert from "node:assert/strict";
import test from "node:test";

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
