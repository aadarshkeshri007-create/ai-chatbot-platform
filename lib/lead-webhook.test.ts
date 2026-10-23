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
  const result = await deliverLeadToWebhook("https://hooks.example.test/lead", {
    ...submittedLead,
    timestamp: "2026-10-21T15:00:00.000Z",
  }, async (input, init) => {
    receivedUrl = String(input);
    receivedInit = init;
    return new Response(null, { status: 202 });
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(receivedUrl, "https://hooks.example.test/lead");
  assert.equal(receivedInit?.method, "POST");
  assert.equal(new Headers(receivedInit?.headers).get("Content-Type"), "application/json");
  const body = String(receivedInit?.body);
  const parsed = JSON.parse(body) as Record<string, unknown>;
  assert.deepEqual(parsed, expectedPayload);
  assert.deepEqual(Object.keys(parsed), ["name", "email", "question", "timestamp"]);
  assert.equal(["Name", "Email", "Question", "Timestamp"].some((key) => key in parsed), false);
});

test("missing configuration, network errors, timeouts, and HTTP failures remain distinct and safe", async () => {
  assert.deepEqual(await deliverLeadToWebhook(undefined, {
    name: "Ada", email: "ada@example.com", question: "Help", timestamp: "2026-10-21T10:00:00.000Z",
  }), { ok: false, reason: "missing_configuration" });
  assert.deepEqual(await deliverLeadToWebhook("https://hooks.example.test/lead", {
    name: "Ada", email: "ada@example.com", question: "Help", timestamp: "2026-10-21T10:00:00.000Z",
  }, async () => new Response("private provider detail", { status: 404 })), {
    ok: false, reason: "http_rejected", status: 404,
  });
  assert.deepEqual(await deliverLeadToWebhook("https://hooks.example.test/lead", {
    name: "Ada", email: "ada@example.com", question: "Help", timestamp: "2026-10-21T10:00:00.000Z",
  }, async () => { throw new TypeError("private DNS/TLS detail"); }), { ok: false, reason: "network_failure" });
  assert.deepEqual(await deliverLeadToWebhook("https://hooks.example.test/lead", {
    name: "Ada", email: "ada@example.com", question: "Help", timestamp: "2026-10-21T10:00:00.000Z",
  }, async () => { const error = new Error("private timeout detail"); error.name = "TimeoutError"; throw error; }), { ok: false, reason: "timeout" });
});

test("delivery failure codes give a safe next step and classify n8n HTTP responses", () => {
  assert.deepEqual(describeLeadWebhookFailure({ ok: false, reason: "missing_configuration" }), {
    code: "N8N_WEBHOOK_NOT_CONFIGURED",
    message: "Lead delivery is not configured. Please contact the site owner.",
    status: 503,
  });
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
