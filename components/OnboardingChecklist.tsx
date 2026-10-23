"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOnboardingProgress, getOnboardingSteps, isOnboardingDismissed, persistOnboardingDismissal, type OnboardingState } from "@/lib/onboarding";

const emptyState: OnboardingState = {
  hasProcessedKnowledge: false,
  hasSuccessfulAssistantTest: false,
  hasVerifiedWidgetInstall: false,
};

function getLocalStorageSafely(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export default function OnboardingChecklist() {
  const [state, setState] = useState(emptyState);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setReady(true);
        return;
      }
      if (!cancelled) {
        setAccountId(user.id);
        const storage = getLocalStorageSafely();
        setDismissed(storage ? isOnboardingDismissed(user.id, storage) : false);
      }

      const [{ count: processedCount }, { data: conversations }] = await Promise.all([
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "processed"),
        supabase.from("conversations").select("id").eq("is_test", true).order("updated_at", { ascending: false }).limit(100),
      ]);

      const conversationIds = (conversations ?? []).map((conversation) => conversation.id);
      let hasSuccessfulAssistantTest = false;
      if (conversationIds.length > 0) {
        const { data: assistantMessages } = await supabase
          .from("messages")
          .select("id")
          .in("conversation_id", conversationIds)
          .eq("role", "assistant")
          .limit(1);
        hasSuccessfulAssistantTest = Boolean(assistantMessages?.length);
      }

      const installationResponse = await fetch("/api/widget-installation/status", { cache: "no-store" });
      const installation = installationResponse.ok
        ? await installationResponse.json() as { verified?: boolean }
        : null;
      if (!cancelled) {
        setState({
          hasProcessedKnowledge: (processedCount ?? 0) > 0,
          hasSuccessfulAssistantTest,
          hasVerifiedWidgetInstall: installation?.verified === true,
        });
        setReady(true);
      }
    };
    void load().catch(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  if (!ready) return null;
  const steps = getOnboardingSteps(state);
  const progress = getOnboardingProgress(state);
  if (dismissed && progress === 100) return null;

  const dismissCompletedChecklist = () => {
    const storage = getLocalStorageSafely();
    if (accountId && progress === 100 && storage && persistOnboardingDismissal(accountId, storage)) {
      setDismissed(true);
    }
  };
  if (!expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)} className="mx-4 mt-3 flex min-h-10 items-center gap-2 self-start rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--background)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] dark:border-[var(--border)] dark:bg-[var(--surface)] dark:text-[var(--text-primary)] sm:mx-6">
        {progress === 100 ? "Setup checklist complete" : `Setup checklist · ${progress}% complete`}
      </button>
    );
  }

  return (
    <section aria-labelledby="onboarding-heading" className="mx-4 mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm dark:border-[var(--border)] dark:bg-[var(--surface)] sm:mx-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="onboarding-heading" className="text-sm font-semibold text-[var(--text-primary)] dark:text-[var(--text-primary)]">Get your assistant ready</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">{progress}% complete · based on processed knowledge, saved assistant replies, and a verified widget load.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" aria-label="Hide setup checklist" onClick={() => setExpanded(false)} className="rounded-[var(--radius-control)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--surface-muted)]">Hide</button>
          {progress === 100 && accountId && (
            <button type="button" aria-label="Dismiss completed setup checklist" title="Dismiss completed setup checklist" onClick={dismissCompletedChecklist} className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--surface-muted)]">
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)] dark:bg-[var(--surface-muted)]" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <div className="h-full rounded-full bg-[var(--accent)] transition-[width] dark:bg-[var(--accent)]" style={{ width: `${progress}%` }} />
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-3">
        {steps.map((step) => (
          <li key={step.id}>
            <Link href={step.href} className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] dark:border-[var(--border)] dark:text-[var(--text-primary)]">
              <span aria-hidden="true" className={step.complete ? "text-[var(--success)] dark:text-[var(--success)]" : "text-[var(--text-secondary)] dark:text-[var(--text-secondary)]"}>{step.complete ? "✓" : "○"}</span>
              <span>{step.label}</span>
              {step.complete && <span className="ml-auto text-[var(--success)] dark:text-[var(--success)]">Done</span>}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
