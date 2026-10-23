import assert from "node:assert/strict";
import test from "node:test";
import { getOnboardingProgress, getOnboardingSteps, isOnboardingDismissed, onboardingDismissalKey, persistOnboardingDismissal } from "./onboarding.ts";

test("onboarding only completes steps from supplied persisted-operation signals", () => {
  const state = {
    hasProcessedKnowledge: false,
    hasSuccessfulAssistantTest: true,
    hasVerifiedWidgetInstall: false,
  };
  assert.deepEqual(getOnboardingSteps(state).map(({ complete }) => complete), [false, true, false]);
  assert.equal(getOnboardingProgress(state), 33);
});

test("onboarding reaches 100 percent only when every step has a verified signal", () => {
  assert.equal(getOnboardingProgress({
    hasProcessedKnowledge: true,
    hasSuccessfulAssistantTest: true,
    hasVerifiedWidgetInstall: true,
  }), 100);
});

test("completed checklist dismissal persists per account", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  assert.equal(persistOnboardingDismissal("account-a", storage), true);
  assert.equal(isOnboardingDismissed("account-a", storage), true);
  assert.equal(isOnboardingDismissed("account-b", storage), false);
  assert.equal(onboardingDismissalKey("account-a"), "supportai:onboarding:dismissed:account-a");
});
