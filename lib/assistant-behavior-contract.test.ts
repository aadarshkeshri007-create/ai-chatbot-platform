import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("dashboard and public chat consume the same persisted behavior helpers", async () => {
  const [dashboard, widget, migration] = await Promise.all([
    readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/public/chat/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20261022110000_add_assistant_behavior_settings.sql", import.meta.url), "utf8"),
  ]);
  for (const route of [dashboard, widget]) {
    assert.match(route, /responseToneInstruction\(.*responseTone/);
    assert.match(route, /languageInstruction\(/);
    assert.match(route, /unknownAnswerMessage\(/);
    assert.match(route, /fallbackMessage/);
  }
  for (const field of ["response_tone", "response_language", "unknown_answer_behavior", "unknown_answer_message", "handoff_enabled", "handoff_intro"]) {
    assert.ok(migration.includes(field), `migration includes ${field}`);
  }
  assert.match(migration, /from public\.profiles as p\s+where p\.assistant_id = requested_assistant_id/);
  assert.match(migration, /grant execute on function public\.get_public_assistant_for_chat\(uuid\)\s+to service_role/);
  assert.match(migration, /response_tone in \('professional', 'friendly', 'concise', 'empathetic'\)/);
  assert.match(migration, /response_language in \('auto', 'en', 'es', 'fr', 'de', 'pt', 'hi', 'ja', 'zh', 'ar'\)/);
  assert.match(migration, /unknown_answer_behavior in \('contact_support', 'offer_handoff', 'custom_message'\)/);
});

test("settings only load and update behavior fields through the signed-in owner's profile", async () => {
  const settings = await readFile(new URL("../app/(app)/settings/page.tsx", import.meta.url), "utf8");
  assert.match(settings, /\.select\("response_tone, response_language, unknown_answer_behavior, unknown_answer_message, handoff_enabled, handoff_intro"\)\s*\.eq\("id", user\.id\)/);
  assert.match(settings, /\.update\(\{[\s\S]*?response_tone: responseTone[\s\S]*?handoff_intro: handoffIntro\.trim\(\)[\s\S]*?\}\)[\s\S]*?\.eq\("id", user\.id\)/);
  assert.match(settings, /unknownAnswerMessage\.trim\(\)\.length > 500/);
});

test("public handoff endpoint enforces the persisted enable switch", async () => {
  const handoff = await readFile(new URL("../app/api/public/handoff/route.ts", import.meta.url), "utf8");
  assert.match(handoff, /\.select\("id, assistant_id, business_name, allowed_domains, handoff_enabled"\)/);
  assert.match(handoff, /profile\.handoff_enabled === false/);
});
