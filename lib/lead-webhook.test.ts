import assert from "node:assert/strict";
import test from "node:test";
import { createLeadWebhookPayload, deliverLeadToWebhook, describeLeadWebhookFailure, parseLeadInput } from "./lead-webhook.ts";

test("lead input is trimmed and rejects missing, malformed, or oversized values", () => {
  assert.deepEqual(parseLeadInput({ name: " Ada ", email: " ada@example.com ", question: " Help? " }), {
    name: "Ada", email: "ada@example.com", question: "Help?",
  });
  for (const input of [
    {}, { name: " ", email: "ada@example.com", question: "Help" },
    { name: "Ada", email: "invalid", question: "Help" },
    { name: "Ada", email: "ada@example.com", question: " " },
    { name: "a".repeat(121), email: "ada@example.com", question: "Help" },
    { name: "Ada", email: "ada@example.com", question: "q".repeat(5001) },
    null,
  ]) assert.equal(parseLeadInput(input), null);
});

test("lead payload maps fields and adds an ISO timestamp", () => {
  const payload = createLeadWebhookPayload({ name: "Ada", email: "ada@example.com", question: "Help" }, new Date("2026-10-21T10:00:00.000Z"));
  assert.deepEqual(payload, {
    name: "Ada", email: "ada@example.com", question: "Help", timestamp: "2026-10-21T10:00:00.000Z",
  });
  assert.deepEqual(Object.keys(payload), ["name", "email", "question", "timestamp"]);
  assert.equal("Name" in payload || "Email" in payload || "Question" in payload || "Timestamp" in payload, false);
});

test("lead delivery sends the exact lowercase JSON contract and reports success only when accepted", async () => {
  let receivedUrl = "";
  let receivedInit: RequestInit | undefined;
  const submittedLead = { name: "Alex Mercer", email: "alex@example.com", question: "Interested in your $350 automation package." };
  const expectedPayload = {
    name: submittedLead.name,
    email: submittedLead.email,
    question: submittedLead.question,
    timestamp: "2026-10-21T15:00:00.000Z",
  };
  const result = await deliverLeadToWebhook(
    "https://hooks.example.test/lead",
    {
      ...submittedLead,
      timestamp: "2026-10-21T15:00:00.000Z",
    },
    "test-secret-value",
    async (input, init) => {
      receivedUrl = String(input);
      receivedInit = init;
      return new Response(null, { status: 202 });
    },
  );
  assert.deepEqual(result, { ok: true });
  assert.equal(receivedUrl, "https://hooks.example.test/lead");
  assert.equal(receivedInit?.method, "POST");
  assert.equal(new Headers(receivedInit?.headers).get("Content-Type"), "application/json");
  assert.equal(new Headers(receivedInit?.headers).get("X-SupportAI-Webhook-Secret"), "test-secret-value");
  const body = String(receivedInit?.body);
  const parsed = JSON.parse(body) as Record<string, unknown>;
  assert.deepEqual(parsed, expectedPayload);
  assert.deepEqual(Object.keys(parsed), ["name", "email", "question", "timestamp"]);
  assert.equal(["Name", "Email", "Question", "Timestamp"].some((key) => key in parsed), false);
});

test("missing configuration, missing secret, network errors, timeouts, and HTTP failures remain distinct and safe", async () => {
  let networkCalled = false;
  const mockLead = {
    name: "Ada", email: "ada@example.com", question: "Help", timestamp: "2026-10-21T10:00:00.000Z",
  };

  // Missing URL prevents network call
  assert.deepEqual(await deliverLeadToWebhook(undefined, mockLead, "test-secret", async () => {
    networkCalled = true;
    return new Response(null, { status: 200 });
  }), { ok: false, reason: "missing_configuration" });
  assert.equal(networkCalled, false, "network fetch must not be called when URL is missing");

  // Missing secret prevents network call
  assert.deepEqual(await deliverLeadToWebhook("https://hooks.example.test/lead", mockLead, undefined, async () => {
    networkCalled = true;
    return new Response(null, { status: 200 });
  }), { ok: false, reason: "missing_configuration" });
  assert.equal(networkCalled, false, "network fetch must not be called when secret is missing");

  // Blank secret prevents network call
  assert.deepEqual(await deliverLeadToWebhook("https://hooks.example.test/lead", mockLead, "   ", async () => {
    networkCalled = true;
    return new Response(null, { status: 200 });
  }), { ok: false, reason: "missing_configuration" });
  assert.equal(networkCalled, false, "network fetch must not be called when secret is whitespace");

  // HTTP rejection
  assert.deepEqual(await deliverLeadToWebhook("https://hooks.example.test/lead", mockLead, "test-secret", async () => new Response("private provider detail", { status: 404 })), {
    ok: false, reason: "http_rejected", status: 404,
  });

  // Network failure
  assert.deepEqual(await deliverLeadToWebhook("https://hooks.example.test/lead", mockLead, "test-secret", async () => { throw new TypeError("private DNS/TLS detail"); }), { ok: false, reason: "network_failure" });

  // Timeout failure
  assert.deepEqual(await deliverLeadToWebhook("https://hooks.example.test/lead", mockLead, "test-secret", async () => { const error = new Error("private timeout detail"); error.name = "TimeoutError"; throw error; }), { ok: false, reason: "timeout" });
});

test("delivery failure codes give a safe next step, classify n8n HTTP responses, and never expose secrets", () => {
  const secret = "top-secret-token-12345";
  const missingFailure = describeLeadWebhookFailure({ ok: false, reason: "missing_configuration" });
  assert.deepEqual(missingFailure, {
    code: "N8N_WEBHOOK_NOT_CONFIGURED",
    message: "Lead delivery is not configured. Please contact the site owner.",
    status: 503,
  });
  assert.doesNotMatch(JSON.stringify(missingFailure), new RegExp(secret));
  assert.doesNotMatch(missingFailure.message, /secret|token|credential/i);

  assert.equal(describeLeadWebhookFailure({ ok: false, reason: "network_failure" }).code, "N8N_NETWORK_FAILURE");
  assert.equal(describeLeadWebhookFailure({ ok: false, reason: "timeout" }).status, 504);
  assert.deepEqual(describeLeadWebhookFailure({ ok: false, reason: "http_rejected", status: 404 }), {
    code: "N8N_WEBHOOK_NOT_FOUND",
    message: "The lead service endpoint was not found. The site owner should activate the n8n workflow and check its Production URL.",
    status: 502,
    upstreamStatus: 404,
  });
  assert.equal(describeLeadWebhookFailure({ ok: false, reason: "http_rejected", status: 403 }).code, "N8N_WEBHOOK_AUTH_REJECTED");
  assert.equal(describeLeadWebhookFailure({ ok: false, reason: "http_rejected", status: 500 }).code, "N8N_SERVER_ERROR");
});

test("webhook diagnostics and error structures strictly omit secrets and credentials", async () => {
  const secret = "super-secret-authorization-key-999";
  const mockLead = {
    name: "Alex",
    email: "alex@example.com",
    question: "Do you offer SOC2?",
    timestamp: "2026-10-24T10:00:00.000Z",
  };

  const results = [
    await deliverLeadToWebhook(undefined, mockLead, secret),
    await deliverLeadToWebhook("https://hooks.example.test", mockLead, undefined),
    await deliverLeadToWebhook("not-a-valid-url", mockLead, secret),
    await deliverLeadToWebhook("https://hooks.example.test", mockLead, secret, async () => new Response("error", { status: 401 })),
    await deliverLeadToWebhook("https://hooks.example.test", mockLead, secret, async () => new Response("error", { status: 503 })),
  ];

  for (const res of results) {
    if (!res.ok) {
      const serialized = JSON.stringify(res);
      assert.doesNotMatch(serialized, new RegExp(secret));
      const failure = describeLeadWebhookFailure(res);
      const failureSerialized = JSON.stringify(failure);
      assert.doesNotMatch(failureSerialized, new RegExp(secret));
      assert.doesNotMatch(failure.message, /secret|password|token|bearer/i);
    }
  }
});
