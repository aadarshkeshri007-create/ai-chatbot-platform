"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import AuthLayout from "@/components/AuthLayout";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
    const [checking, setChecking] = useState(true);
    const [recoveryAvailable, setRecoveryAvailable] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

    useEffect(() => {
        const supabase = createClient();
        let active = true;
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (active && (event === "PASSWORD_RECOVERY" || session)) {
                setRecoveryAvailable(true);
                setChecking(false);
            }
        });

        void supabase.auth.getUser().then(({ data, error }) => {
            if (!active) return;
            setRecoveryAvailable(!error && !!data.user);
            setChecking(false);
            if (new URLSearchParams(window.location.search).has("error")) {
                setFeedback({ kind: "error", message: "That recovery link is invalid or expired. Request a new one." });
            }
        }).catch(() => {
            if (!active) return;
            setRecoveryAvailable(false);
            setChecking(false);
        });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, []);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFeedback(null);
        if (newPassword.length < 8) {
            setFeedback({ kind: "error", message: "Use a password with at least 8 characters." });
            return;
        }
        if (newPassword !== confirmPassword) {
            setFeedback({ kind: "error", message: "The passwords do not match." });
            return;
        }

        setLoading(true);
        try {
            const supabase = createClient();
            const { data: { user }, error: sessionError } = await supabase.auth.getUser();
            if (sessionError || !user) {
                setRecoveryAvailable(false);
                setFeedback({ kind: "error", message: "Your recovery session is no longer valid. Request a new link." });
                return;
            }
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) {
                setFeedback({ kind: "error", message: "Unable to update your password. Check the password requirements and try again." });
                return;
            }
            setNewPassword("");
            setConfirmPassword("");
            setFeedback({ kind: "success", message: "Your password has been updated. You can continue to your workspace." });
        } catch {
            setFeedback({ kind: "error", message: "Unable to update your password right now. Please try again." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout>
            <div className="flex w-full flex-col gap-7">
                <header className="flex flex-col gap-2 text-left">
                    <p className="workspace-kicker">Account recovery</p>
                    <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                        Choose a new password
                    </h1>
                    <p className="text-sm leading-6 text-[var(--text-secondary)]">
                        Enter your new password to regain access to your workspace.
                    </p>
                </header>
                {checking ? (
                    <div className="flex items-center gap-3 py-6" role="status">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
                        <p className="text-sm text-[var(--text-secondary)]">Checking your recovery session…</p>
                    </div>
                ) : recoveryAvailable ? (
                    <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="new-password" className="text-sm font-medium text-[var(--text-primary)] dark:text-[var(--text-secondary)]">
                                New password
                            </label>
                            <input
                                id="new-password"
                                type="password"
                                autoComplete="new-password"
                                minLength={8}
                                required
                                value={newPassword}
                                onChange={(event) => setNewPassword(event.target.value)}
                                placeholder="Min. 8 characters"
                                className="w-full min-h-[44px] sm:min-h-[40px] border border-[var(--border)] rounded-lg px-3.5 py-2.5 text-base sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]/20 focus:border-[var(--focus)] transition-all duration-150 dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--text-primary)] dark:placeholder:text-[var(--text-secondary)] dark:focus:border-[var(--focus)]"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="confirm-password" className="text-sm font-medium text-[var(--text-primary)] dark:text-[var(--text-secondary)]">
                                Confirm new password
                            </label>
                            <input
                                id="confirm-password"
                                type="password"
                                autoComplete="new-password"
                                minLength={8}
                                required
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                placeholder="Min. 8 characters"
                                className="w-full min-h-[44px] sm:min-h-[40px] border border-[var(--border)] rounded-lg px-3.5 py-2.5 text-base sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]/20 focus:border-[var(--focus)] transition-all duration-150 dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--text-primary)] dark:placeholder:text-[var(--text-secondary)] dark:focus:border-[var(--focus)]"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full min-h-11 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 active:brightness-90 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
                        >
                            {loading ? "Updating…" : "Update password"}
                        </button>
                    </form>
                ) : (
                    <div className="flex flex-col gap-4">
                        <p className="text-sm text-[var(--text-secondary)]">
                            This password recovery session is invalid or has expired.
                        </p>
                        <Link href="/forgot-password" className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">
                            Request a new recovery link
                        </Link>
                    </div>
                )}
                {feedback && (
                    <div
                        role={feedback.kind === "error" ? "alert" : "status"}
                        className={`rounded-lg border p-3 text-sm ${
                            feedback.kind === "error"
                                ? "border-[color-mix(in_srgb,var(--error)_35%,var(--border))] bg-[var(--error-soft)] text-[var(--error)]"
                                : "border-[color-mix(in_srgb,var(--success)_35%,var(--border))] bg-[var(--success-soft)] text-[var(--success)]"
                        }`}
                    >
                        {feedback.message}
                    </div>
                )}
                {feedback?.kind === "success" && (
                    <Link
                        href="/chat"
                        className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                    >
                        Continue to workspace
                    </Link>
                )}
                <div className="text-center">
                    <Link href="/login" className="text-sm font-medium text-[var(--accent-link)] hover:underline">
                        Back to sign in
                    </Link>
                </div>
            </div>
        </AuthLayout>
    );
}
