import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("settings load and save profile preferences only for the authenticated user", async () => {
  const settings = await readFile(new URL("../app/(app)/settings/page.tsx", import.meta.url), "utf8");

  assert.match(settings, /supabase\.auth\.getUser\(\)/);
  assert.match(settings, /\.from\("profiles"\)[\s\S]*?\.eq\("id", user\.id\)/);
  assert.match(settings, /response_tone: responseTone/);
  assert.match(settings, /response_language: responseLanguage/);
  assert.match(settings, /unknown_answer_behavior: unknownAnswerBehavior/);
  assert.match(settings, /handoff_enabled: handoffEnabled/);
  assert.match(settings, /response_length: responseLength/);
  assert.match(settings, /\.update\(\{[\s\S]*?\}\)[\s\S]*?\.eq\("id", user\.id\)/);
});

test("settings wait for persisted preferences before enabling response controls", async () => {
  const settings = await readFile(new URL("../app/(app)/settings/page.tsx", import.meta.url), "utf8");
  assert.match(settings, /disabled=\{identityLoading \|\| identitySaving \|\| !behaviorSettingsAvailable\}/);
  assert.match(settings, /useTheme\(\)/);
});

test("profile name updates use the authenticated user's Supabase Auth session", async () => {
  const profile = await readFile(new URL("../app/(app)/profile/page.tsx", import.meta.url), "utf8");

  assert.match(profile, /supabase\.auth\.updateUser\(\{ data: \{ full_name: nextName \} \}\)/);
  assert.match(profile, /getProfileName\(data\.user\.user_metadata, data\.user\.email\)/);
  assert.match(profile, /normalizeProfileName\(fullName\)/);
  assert.doesNotMatch(profile, /updateUser\(\{ email:/);
});
