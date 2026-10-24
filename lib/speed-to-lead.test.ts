import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createLeadWebhookPayload,
  deliverLeadToWebhook,
  describeLeadWebhookFailure,
  parseLeadInput,
  type LeadInput,
} from "./lead-webhook.ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("Speed-to-Lead: lead input validation trims, normalizes email to lowercase, and enforces constraints", () => {
  const valid = parseLeadInput({
    name: "  Jordan Smith  ",
    email: "  Jordan.Smith@Company.Example.COM  ",
    question: "  What are the onboarding SLAs?  ",
  });
  assert.deepEqual(valid, {
    name: "Jordan Smith",
    email: "jordan.smith@company.example.com",
    question: "What are the onboarding SLAs?",
  });

  // Rejections
  assert.equal(parseLeadInput(null), null);
  assert.equal(parseLeadInput({}), null);
  assert.equal(parseLeadInput({ name: "", email: "user@example.com", question: "Hi" }), null);
  assert.equal(parseLeadInput({ name: "User", email: "not-an-email", question: "Hi" }), null);
  assert.equal(parseLeadInput({ name: "User", email: "user@example.com", question: "   " }), null);
  assert.equal(parseLeadInput({ name: "a".repeat(121), email: "user@example.com", question: "Hi" }), null);
  assert.equal(parseLeadInput({ name: "User", email: "user@example.com", question: "q".repeat(5001) }), null);
});

test("Speed-to-Lead: n8n payload structure matches the active workflow contract", () => {
  const lead: LeadInput = {
    name: "Devon Vance",
    email: "devon@example.com",
    question: "Can we integrate with our CRM?",
  };
  const fixedDate = new Date("2026-10-23T12:00:00.000Z");
  const payload = createLeadWebhookPayload(lead, fixedDate);

  // Active n8n workflow expects lowercase keys: name, email, question, timestamp
  assert.deepEqual(payload, {
    name: "Devon Vance",
    email: "devon@example.com",
    question: "Can we integrate with our CRM?",
    timestamp: "2026-10-23T12:00:00.000Z",
  });
  const keys = Object.keys(payload);
  assert.deepEqual(keys.sort(), ["email", "name", "question", "timestamp"]);
  assert.ok(!("user_id" in payload));
  assert.ok(!("assistant_id" in payload));
});

test("Speed-to-Lead: webhook delivery handles success and network/timeout failures deterministically", async () => {
  const payload = {
    name: "Morgan",
    email: "morgan@example.com",
    question: "Pricing inquiry",
    timestamp: "2026-10-23T12:00:00.000Z",
  };

  // Missing webhook URL
  const missingResult = await deliverLeadToWebhook(undefined, payload, "test-secret");
  assert.deepEqual(missingResult, { ok: false, reason: "missing_configuration" });
  if (!missingResult.ok) {
    assert.equal(describeLeadWebhookFailure(missingResult).code, "N8N_WEBHOOK_NOT_CONFIGURED");
  }

  // Missing webhook secret prevents network call
  let networkCalled = false;
  const missingSecretResult = await deliverLeadToWebhook("https://supportai.app.n8n.cloud/webhook/lead-intake", payload, undefined, async () => {
    networkCalled = true;
    return new Response(null, { status: 200 });
  });
  assert.deepEqual(missingSecretResult, { ok: false, reason: "missing_configuration" });
  assert.equal(networkCalled, false, "network fetch must not be called when secret is missing");

  // Invalid protocol (non-https in production)
  const invalidResult = await deliverLeadToWebhook("ftp://invalid.hook", payload, "test-secret");
  assert.deepEqual(invalidResult, { ok: false, reason: "invalid_configuration" });

  // Successful response from n8n sends X-SupportAI-Webhook-Secret
  let sentBody: string | undefined;
  let sentHeaders: Headers | undefined;
  const successResult = await deliverLeadToWebhook("https://supportai.app.n8n.cloud/webhook/lead-intake", payload, "test-secret", async (_url, init) => {
    sentBody = init?.body as string;
    sentHeaders = new Headers(init?.headers);
    return new Response(JSON.stringify({ message: "Workflow got started." }), { status: 200 });
  });
  assert.deepEqual(successResult, { ok: true });
  assert.equal(JSON.parse(sentBody ?? "{}").name, "Morgan");
  assert.equal(sentHeaders?.get("X-SupportAI-Webhook-Secret"), "test-secret");
  assert.equal(sentHeaders?.get("Content-Type"), "application/json");

  // Timeout failure
  const timeoutResult = await deliverLeadToWebhook("https://supportai.app.n8n.cloud/webhook/lead-intake", payload, "test-secret", async () => {
    const error = new Error("Request timed out");
    error.name = "TimeoutError";
    throw error;
  });
  assert.deepEqual(timeoutResult, { ok: false, reason: "timeout" });
  if (!timeoutResult.ok) {
    assert.equal(describeLeadWebhookFailure(timeoutResult).code, "N8N_REQUEST_TIMEOUT");
  }

  // Upstream 500 error
  const serverErrorResult = await deliverLeadToWebhook("https://supportai.app.n8n.cloud/webhook/lead-intake", payload, "test-secret", async () => {
    return new Response("Internal Server Error", { status: 500 });
  });
  assert.deepEqual(serverErrorResult, { ok: false, reason: "http_rejected", status: 500 });
  if (!serverErrorResult.ok) {
    assert.equal(describeLeadWebhookFailure(serverErrorResult).code, "N8N_SERVER_ERROR");
  }
});

test("Speed-to-Lead: lead route contract inspects Supabase errors, decouples delivery, and handles deduplication safely", async () => {
  const route = await read("../app/api/leads/route.ts");

  // Origin check happens first
  const originIdx = route.indexOf("isAllowedAssistantOrigin(request, profile.allowed_domains)");
  assert.ok(originIdx > 0, "Origin check is enforced against allowed_domains");

  // Rate limit check
  const rateLimitIdx = route.indexOf("checkPublicChatRateLimit(request, assistantId)");
  assert.ok(rateLimitIdx > originIdx, "Rate limit is checked after tenant/origin verification");

  // Deduplication query checks error explicitly and does not treat failure as absent
  const dedupIdx = route.indexOf(".from(\"leads\")");
  assert.ok(dedupIdx > rateLimitIdx, "Deduplication query checks existing recent leads");
  assert.match(route, /dedupError/);
  assert.match(route, /LEAD_DEDUPLICATION_CHECK_FAILED/);
  assert.match(route, /\.gte\("created_at",\s*recentCutoff\)/);

  // Persistence into public.leads table with correct schema fields and error handling
  const insertIdx = route.indexOf(".insert(leadInsertPayload)");
  assert.ok(insertIdx > dedupIdx, "Persistence occurs before webhook call");
  assert.match(route, /leadInsertPayload[\s\S]*?assistant_id:\s*assistantId/);
  assert.match(route, /leadInsertPayload[\s\S]*?name:\s*lead\.name/);
  assert.match(route, /leadInsertPayload[\s\S]*?email:\s*lead\.email/);
  assert.match(route, /leadInsertPayload[\s\S]*?question:\s*lead\.question/);
  assert.match(route, /insertError/);
  assert.match(route, /LEAD_PERSISTENCE_FAILED/);
  assert.doesNotMatch(route, /user_id:\s*profile\.id.*\.from\("leads"\)/);

  // Concurrency duplicate (23505) race condition handling
  assert.match(route, /insertError\.code\s*===\s*"23505"/);

  // Dashboard handoff inbox sync checks error explicitly and preserves lead if sync fails
  assert.match(route, /handoffInsertError/);
  assert.match(route, /HANDOFF_SYNC_FAILED/);

  // Webhook delivery runs after lead is saved and passes N8N_WEBHOOK_SECRET
  const webhookIdx = route.lastIndexOf("deliverLeadToWebhook(");
  assert.ok(webhookIdx > insertIdx, "Webhook delivery runs after persistence succeeds");
  assert.match(route, /process\.env\.N8N_WEBHOOK_SECRET/);

  // Delivery status tracking: updates status to acknowledged, uncertain, or failed
  assert.match(route, /webhook_delivery_status:\s*"acknowledged"/);
  assert.match(route, /webhook_delivery_status:\s*isTimeout\s*\?\s*"uncertain"\s*:\s*"failed"/);

  // If webhook fails or times out, route preserves lead and returns honest status
  assert.match(route, /delivered:\s*false/);
  assert.match(route, /delivery_code:\s*failure\.code/);
  assert.match(route, /uncertain:\s*true/);

  // Safe logging: no private customer messages or secrets in logs
  assert.doesNotMatch(route, /console\.(error|log|warn)\(.*lead\.question/);
  assert.doesNotMatch(route, /console\.(error|log|warn)\(.*lead\.email/);
  assert.doesNotMatch(route, /console\.(error|log|warn)\(.*N8N_WEBHOOK_SECRET/);
});

test("Speed-to-Lead: handoff route handles Supabase errors, isolates lead sync, and eliminates naive alreadyDelivered", async () => {
  const handoffRoute = await read("../app/api/public/handoff/route.ts");

  // Schema check: leads table columns must match assistant_id, name, email, question
  assert.match(handoffRoute, /assistant_id:\s*assistantId/);
  assert.match(handoffRoute, /email:\s*customerEmail/);
  assert.match(handoffRoute, /question:\s*reason/);
  assert.doesNotMatch(handoffRoute, /\.from\("leads"\)\.insert\(\{[\s\S]*?user_id:/);
  assert.doesNotMatch(handoffRoute, /\.from\("leads"\)\.insert\(\{[\s\S]*?message:\s*reason/);

  // Deduplication check: checks error explicitly, not just data
  assert.match(handoffRoute, /checkError/);
  assert.match(handoffRoute, /LEAD_DEDUPLICATION_CHECK_FAILED/);

  // Lead sync insert checks error explicitly
  assert.match(handoffRoute, /insertError/);
  assert.match(handoffRoute, /LEAD_SYNC_INSERT_FAILED/);

  // Handoff isolation: if lead sync fails, handoff request is NOT deleted and response succeeds
  assert.match(handoffRoute, /syncState\s*=\s*"failed"/);
  assert.match(handoffRoute, /handoff_id:\s*handoff\.id/);

  // Naive alreadyDelivered boolean is completely removed; delivery requires proper syncState
  assert.doesNotMatch(handoffRoute, /let\s+alreadyDelivered/);
  assert.match(handoffRoute, /syncState\s*===\s*"inserted"\s*\|\|\s*syncState\s*===\s*"deduplicated_retryable"/);

  // Existing lead delivery status inspection: does not assume delivered without acknowledged status
  assert.match(handoffRoute, /status\s*===\s*"acknowledged"/);
  assert.match(handoffRoute, /status\s*===\s*"uncertain"/);
  assert.match(handoffRoute, /status\s*===\s*"failed"/);

  // Webhook delivery passes N8N_WEBHOOK_SECRET
  assert.match(handoffRoute, /deliverLeadToWebhook\([\s\S]*?webhookSecret/);

  // GET route error checks distinguish DB failure (503) from missing record (404)
  assert.match(handoffRoute, /handoffError/);
  assert.match(handoffRoute, /profileLookupError/);
  assert.match(handoffRoute, /messagesError/);
});

test("Speed-to-Lead: handoff inbox exposes conversation context and follow-up guidance", async () => {
  const handoffPage = await read("../app/(app)/handoffs/page.tsx");
  const handoffsApi = await read("../app/api/handoffs/route.ts");

  // API returns conversation_id
  assert.match(handoffsApi, /conversation_id/);

  // Handoffs page includes conversation_id in type and UI
  assert.match(handoffPage, /conversation_id\?:\s*string\s*\|\s*null/);
  assert.match(handoffPage, /Open Chat Context/);
  assert.match(handoffPage, /Follow-up required/);
  assert.match(handoffPage, /mailto:\$\{selected\.customer_email\}/);
});

test("Speed-to-Lead: additive database migration defines delivery tracking and indexes", async () => {
  const migration = await read("../supabase/migrations/20261024100000_add_lead_webhook_delivery_tracking.sql");

  // Columns and defaults added
  assert.match(migration, /webhook_delivery_status\s+text/i);
  assert.match(migration, /webhook_acknowledged_at\s+timestamptz/i);
  assert.match(migration, /webhook_attempts\s+integer/i);
  assert.match(migration, /webhook_last_error\s+text/i);
  assert.match(migration, /request_id\s+text/i);
  assert.match(migration, /webhook_delivery_status[\s\S]*?(DEFAULT\s+'pending'|SET\s+DEFAULT\s+'pending')/i);
  assert.match(migration, /webhook_attempts[\s\S]*?(DEFAULT\s+0|SET\s+DEFAULT\s+0)/i);

  // Check constraints
  assert.match(migration, /leads_webhook_delivery_status_check/);
  assert.match(migration, /'pending',\s*'acknowledged',\s*'failed',\s*'uncertain'/);

  // Indexes
  assert.match(migration, /create index if not exists leads_dedup_idx/i);
  assert.match(migration, /create unique index if not exists leads_assistant_request_id_idx/i);
});
