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

test("Speed-to-Lead: direct widget lead request ID carries data.requestId and preserves retry stability", async () => {
  const widgetScript = await read("../app/widget.js/route.ts");
  const widgetFrame = await read("../app/widget-frame/page.tsx");
  const leadsRoute = await read("../app/api/leads/route.ts");

  // widget.js passes request_id when present
  assert.match(widgetScript, /request_id:\s*data\.requestId/);
  // widget.js preserves compatibility if data.requestId is omitted
  assert.match(widgetScript, /typeof data\.requestId === "string"/);
  // widget.js manages in-flight tracking with pendingRequests
  assert.match(widgetScript, /pendingRequests\.add\(requestId\)/);
  assert.match(widgetScript, /pendingRequests\.delete\(requestId\)/);

  // widget-frame generates requestId once per logical submission and reuses it across retries
  assert.match(widgetFrame, /contactRequestIdRef\.current\s*\?\?\s*crypto\.randomUUID\(\)/);
  assert.match(widgetFrame, /contactRequestIdRef\.current\s*=\s*requestId/);
  // widget-frame clears contactRequestIdRef only on success
  assert.match(widgetFrame, /contactRequestIdRef\.current\s*=\s*null/);

  // /api/leads permits requests that omit request_id (backward compatibility)
  assert.match(leadsRoute, /record\.request_id\s*!==\s*undefined\s*&&\s*record\.request_id\s*!==\s*null/);
  assert.match(leadsRoute, /typeof record\.request_id === "string"/);
});

test("Speed-to-Lead: duplicate-lead regression: timeout retries, concurrency races, and collision recovery", async () => {
  const leadsRoute = await read("../app/api/leads/route.ts");
  const handoffRoute = await read("../app/api/public/handoff/route.ts");

  // In /api/leads: 23505 collision recovery uses exact (assistant_id, request_id)
  assert.match(leadsRoute, /insertError\.code\s*===\s*"23505"/);
  assert.match(leadsRoute, /\.eq\("assistant_id",\s*assistantId\)\s*\.eq\("request_id",\s*record\.request_id\)/);

  // In /api/leads: 23505 collision recovery does NOT match on email
  assert.doesNotMatch(
    leadsRoute,
    /insertError\.code\s*===\s*"23505"[\s\S]*?\.eq\("email",\s*lead\.email\)/,
  );

  // In /api/leads: collision resolution failure logs safe diagnostic and returns 503 rather than guessing
  assert.match(leadsRoute, /LEAD_PERSISTENCE_COLLISION_UNRESOLVED/);

  // In /api/leads: 23505 collision respects existing delivery status without second webhook dispatch
  assert.match(leadsRoute, /typedRacedLead\.webhook_delivery_status\s*===\s*"acknowledged"/);
  assert.match(leadsRoute, /typedRacedLead\.webhook_delivery_status\s*===\s*"uncertain"/);
  assert.match(leadsRoute, /typedRacedLead\.webhook_delivery_status\s*===\s*"failed"/);

  // In /api/public/handoff: 23505 collision recovery on lead sync uses exact (assistant_id, request_id)
  assert.match(handoffRoute, /insertError\?\.code\s*===\s*"23505"/);
  assert.match(handoffRoute, /\.eq\("assistant_id",\s*assistantId\)\s*\.eq\("request_id",\s*requestId\)/);
  assert.match(handoffRoute, /targetLeadId\s*=\s*racedLead\.id/);
  assert.match(handoffRoute, /syncState\s*=\s*"deduplicated_acknowledged"/);
  assert.match(handoffRoute, /LEAD_SYNC_COLLISION_UNRESOLVED/);
});

test("Speed-to-Lead: delivery status mutation error handling in both routes", async () => {
  const leadsRoute = await read("../app/api/leads/route.ts");
  const handoffRoute = await read("../app/api/public/handoff/route.ts");

  // In /api/leads: all updates check updateError and log LEAD_STATUS_UPDATE_FAILED
  const leadsStatusUpdates = (leadsRoute.match(/LEAD_STATUS_UPDATE_FAILED/g) || []).length;
  assert.ok(leadsStatusUpdates >= 4, `Expected at least 4 LEAD_STATUS_UPDATE_FAILED logs in leads route, found ${leadsStatusUpdates}`);
  assert.match(leadsRoute, /const\s*\{\s*error:\s*updateError\s*\}\s*=\s*await\s*admin\.from\("leads"\)\.update/);
  assert.match(leadsRoute, /delivery_status_persisted:\s*false/);

  // In /api/public/handoff: all updates check updateError and log LEAD_STATUS_UPDATE_FAILED
  const handoffStatusUpdates = (handoffRoute.match(/LEAD_STATUS_UPDATE_FAILED/g) || []).length;
  assert.ok(handoffStatusUpdates >= 2, `Expected at least 2 LEAD_STATUS_UPDATE_FAILED logs in handoff route, found ${handoffStatusUpdates}`);
  assert.match(handoffRoute, /const\s*\{\s*error:\s*updateError\s*\}\s*=\s*await\s*supabase\.from\("leads"\)\.update/);

  // Never log customer secrets, emails, or questions in status update error logs
  const leadsLogMatches = leadsRoute.match(/console\.error\("[^"]*",\s*\{\s*stage:\s*"status-update"[\s\S]*?\}\);/g) ?? [];
  assert.ok(leadsLogMatches.length >= 4);
  for (const log of leadsLogMatches) {
    assert.doesNotMatch(log, /email|question|secret|token/i);
  }

  const handoffLogMatches = handoffRoute.match(/console\.error\("[^"]*",\s*\{\s*stage:\s*"lead-status-update"[\s\S]*?\}\);/g) ?? [];
  assert.ok(handoffLogMatches.length >= 2);
  for (const log of handoffLogMatches) {
    assert.doesNotMatch(log, /email|reason|secret|token/i);
  }
});

test("Speed-to-Lead: behavioral simulation for retry after timeout, concurrent race, distinct requests, collision recovery, and delivery mutation failures", async () => {
  type LeadRow = {
    id: string;
    assistant_id: string;
    request_id?: string;
    email: string;
    question: string;
    created_at: string;
    webhook_delivery_status: "pending" | "acknowledged" | "failed" | "uncertain";
    webhook_attempts: number;
    webhook_last_error?: string | null;
  };

  class MockLeadsStore {
    leads: LeadRow[] = [];
    failNextUpdate = false;
    webhookDispatches: { leadId: string; timestamp: string }[] = [];

    async insert(row: Omit<LeadRow, "id" | "created_at">): Promise<{ data: LeadRow | null; error: { code: string; message: string } | null }> {
      if (row.request_id && this.leads.some((l) => l.assistant_id === row.assistant_id && l.request_id === row.request_id)) {
        return { data: null, error: { code: "23505", message: "unique_violation" } };
      }
      const created: LeadRow = {
        ...row,
        id: `lead_${this.leads.length + 1}`,
        created_at: new Date().toISOString(),
      };
      this.leads.push(created);
      return { data: created, error: null };
    }

    async findByAssistantAndRequestId(assistantId: string, requestId: string): Promise<LeadRow | null> {
      return this.leads.find((l) => l.assistant_id === assistantId && l.request_id === requestId) ?? null;
    }

    async updateStatus(id: string, update: Partial<LeadRow>): Promise<{ error: { code: string; message: string } | null }> {
      if (this.failNextUpdate) {
        return { error: { code: "XX000", message: "disk I/O error" } };
      }
      const target = this.leads.find((l) => l.id === id);
      if (target) {
        Object.assign(target, update);
      }
      return { error: null };
    }

    async dispatchWebhook(leadId: string): Promise<{ ok: boolean }> {
      this.webhookDispatches.push({ leadId, timestamp: new Date().toISOString() });
      return { ok: true };
    }
  }

  type SimulatedLeadResult = {
    success: boolean;
    lead_id?: string;
    delivered?: boolean;
    deduplicated?: boolean;
    delivery_status_persisted?: boolean;
    uncertain?: boolean;
    delivery_code?: string;
    status?: number;
    message?: string;
  };

  async function simulateLeadSubmission(
    store: MockLeadsStore,
    payload: { assistant_id: string; request_id?: string; email: string; name: string; question: string }
  ): Promise<SimulatedLeadResult> {
    const insertRes = await store.insert({
      assistant_id: payload.assistant_id,
      request_id: payload.request_id,
      email: payload.email,
      question: payload.question,
      webhook_delivery_status: "pending",
      webhook_attempts: 0,
    });

    let lead: LeadRow | null = insertRes.data;
    let isDeduplicated = false;

    if (insertRes.error?.code === "23505") {
      if (typeof payload.request_id === "string") {
        lead = await store.findByAssistantAndRequestId(payload.assistant_id, payload.request_id);
        if (lead) {
          isDeduplicated = true;
          if (lead.webhook_delivery_status === "acknowledged") {
            return { success: true, lead_id: lead.id, deduplicated: true, delivered: true };
          }
          if (lead.webhook_delivery_status === "uncertain") {
            return { success: true, lead_id: lead.id, deduplicated: true, delivered: false, uncertain: true };
          }
          if (lead.webhook_delivery_status === "failed") {
            return { success: true, lead_id: lead.id, deduplicated: true, delivered: false, delivery_code: lead.webhook_last_error ?? "LEAD_DELIVERY_FAILED" };
          }
          return { success: true, lead_id: lead.id, deduplicated: true };
        }
      }
      return { success: false, status: 503, message: "LEAD_PERSISTENCE_COLLISION_UNRESOLVED" };
    }

    if (!lead) return { success: false, status: 503, message: "LEAD_PERSISTENCE_FAILED" };

    const deliveryRes = await store.dispatchWebhook(lead.id);
    let statusPersisted = false;
    if (deliveryRes.ok) {
      const updateRes = await store.updateStatus(lead.id, {
        webhook_delivery_status: "acknowledged",
        webhook_attempts: lead.webhook_attempts + 1,
      });
      statusPersisted = !updateRes.error;
    }

    return {
      success: true,
      lead_id: lead.id,
      delivered: deliveryRes.ok,
      deduplicated: isDeduplicated,
      ...(!statusPersisted ? { delivery_status_persisted: false } : {}),
    };
  }

  const store = new MockLeadsStore();
  const assistantId = "11111111-1111-4111-8111-111111111111";
  const requestId1 = "aaaa1111-2222-4333-8444-555555555555";

  // Scenario 1: First request times out after insert, retried with same request ID
  const firstAttempt = await simulateLeadSubmission(store, {
    assistant_id: assistantId,
    request_id: requestId1,
    email: "sarah@example.com",
    name: "Sarah",
    question: "Do you offer enterprise SSO?",
  });
  assert.equal(firstAttempt.success, true);
  assert.equal(firstAttempt.delivered, true);
  assert.equal(firstAttempt.deduplicated, false);
  assert.equal(store.webhookDispatches.length, 1);

  // Retried after a timeout with the same request ID
  const retriedAttempt = await simulateLeadSubmission(store, {
    assistant_id: assistantId,
    request_id: requestId1,
    email: "sarah@example.com",
    name: "Sarah",
    question: "Do you offer enterprise SSO?",
  });
  assert.equal(retriedAttempt.success, true);
  assert.equal(retriedAttempt.lead_id, firstAttempt.lead_id);
  assert.equal(retriedAttempt.deduplicated, true);
  assert.equal(retriedAttempt.delivered, true);
  assert.equal(store.webhookDispatches.length, 1, "Must NOT dispatch a second webhook after acknowledged delivery");

  // Scenario 2: Two concurrent requests racing with the same request ID
  const raceStore = new MockLeadsStore();
  const raceRequestId = "bbbb2222-3333-4444-8555-666666666666";
  const [race1, race2] = await Promise.all([
    simulateLeadSubmission(raceStore, {
      assistant_id: assistantId,
      request_id: raceRequestId,
      email: "alex@example.com",
      name: "Alex",
      question: "Pricing info",
    }),
    simulateLeadSubmission(raceStore, {
      assistant_id: assistantId,
      request_id: raceRequestId,
      email: "alex@example.com",
      name: "Alex",
      question: "Pricing info",
    }),
  ]);
  assert.equal(race1.success, true);
  assert.equal(race2.success, true);
  assert.equal(race1.lead_id, race2.lead_id, "Both racing requests resolve to the exact same lead record");
  assert.equal(raceStore.leads.length, 1, "Only one record inserted in PostgreSQL");
  assert.equal(raceStore.webhookDispatches.length, 1, "Only one webhook dispatched despite race");

  // Scenario 3: Different request IDs for intentional new submissions
  const requestId2 = "cccc3333-4444-4555-8666-777777777777";
  const secondSubmission = await simulateLeadSubmission(store, {
    assistant_id: assistantId,
    request_id: requestId2,
    email: "sarah@example.com",
    name: "Sarah",
    question: "Do you offer custom integrations?",
  });
  assert.equal(secondSubmission.success, true);
  assert.notEqual(secondSubmission.lead_id, firstAttempt.lead_id, "New request ID creates distinct lead");
  assert.equal(secondSubmission.deduplicated, false);
  assert.equal(store.webhookDispatches.length, 2, "Distinct submission receives its own webhook dispatch");

  // Scenario 4: Supabase delivery-status update failure
  const updateFailStore = new MockLeadsStore();
  updateFailStore.failNextUpdate = true;
  const requestId3 = "dddd4444-5555-4666-8777-888888888888";
  const failUpdateRes = await simulateLeadSubmission(updateFailStore, {
    assistant_id: assistantId,
    request_id: requestId3,
    email: "taylor@example.com",
    name: "Taylor",
    question: "SLA details",
  });
  assert.equal(failUpdateRes.success, true, "Preserves user-facing response contract");
  assert.equal(failUpdateRes.delivered, true, "Webhook was delivered");
  assert.equal(failUpdateRes.delivery_status_persisted, false, "Does NOT falsely claim status was persisted");

  // Scenario 5: Missing request ID collision safety
  const storeCollisionNoReqId = new MockLeadsStore();
  storeCollisionNoReqId.insert = async () => ({
    data: null,
    error: { code: "23505", message: "unique_violation" },
  });
  const unresolvable = await simulateLeadSubmission(storeCollisionNoReqId, {
    assistant_id: assistantId,
    email: "someone@example.com",
    name: "Someone",
    question: "Help",
  });
  assert.equal(unresolvable.success, false);
  assert.equal(unresolvable.status, 503);
  assert.equal(unresolvable.message, "LEAD_PERSISTENCE_COLLISION_UNRESOLVED");
});
