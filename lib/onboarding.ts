export type OnboardingState = {
  hasProcessedKnowledge: boolean;
  hasSuccessfulAssistantTest: boolean;
  hasVerifiedWidgetInstall: boolean;
};

export type OnboardingStep = {
  id: "knowledge" | "test" | "install";
  label: string;
  href: string;
  complete: boolean;
};

export function onboardingDismissalKey(userId: string): string {
  return `supportai:onboarding:dismissed:${userId}`;
}

export function isOnboardingDismissed(
  userId: string,
  storage: Pick<Storage, "getItem">,
): boolean {
  try {
    return storage.getItem(onboardingDismissalKey(userId)) === "true";
  } catch {
    return false;
  }
}

export function persistOnboardingDismissal(
  userId: string,
  storage: Pick<Storage, "setItem">,
): boolean {
  try {
    storage.setItem(onboardingDismissalKey(userId), "true");
    return true;
  } catch {
    return false;
  }
}

export function getOnboardingSteps(state: OnboardingState): OnboardingStep[] {
  return [
    { id: "knowledge", label: "Add knowledge", href: "/upload", complete: state.hasProcessedKnowledge },
    { id: "test", label: "Test your assistant", href: "/chat", complete: state.hasSuccessfulAssistantTest },
    { id: "install", label: "Install the widget", href: "/install", complete: state.hasVerifiedWidgetInstall },
  ];
}

export function getOnboardingProgress(state: OnboardingState): number {
  const steps = getOnboardingSteps(state);
  return Math.round((steps.filter((step) => step.complete).length / steps.length) * 100);
}
