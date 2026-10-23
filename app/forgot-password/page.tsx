"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import AuthLayout from "@/components/AuthLayout";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoading(true);
        try {
            const supabase = createClient();
            await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: new URL("/auth/callback", window.location.origin).toString(),
            });
        } catch {
            // Keep the response identical for registered and unregistered emails.
        } finally {
            setSubmitted(true);
            setLoading(false);
        }
    };

    return (
        <AuthLayout>
            <div className="flex w-full flex-col gap-7">
                <header className="flex flex-col gap-2 text-left">
                    <p className="workspace-kicker">Account recovery</p>
                    <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                        Forgot your password?
                    </h1>
                    <p className="text-sm leading-6 text-[var(--text-secondary)]">
                        Enter your account email and we&apos;ll send recovery instructions if an account matches.
                    </p>
                </header>
                {submitted ? (
                    <div className="flex flex-col gap-4">
                        <div role="status" className="rounded-lg border border-[var(--border)] bg-[var(--success-soft)] p-3 text-sm text-[var(--success)] dark:border-[color-mix(in_srgb,var(--success)_35%,var(--border))]">
                            If an account matches that email, recovery instructions will be sent shortly.
                        </div>
                        <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">
                            Back to sign in
                        </Link>
                    </div>
                ) : (
                    <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="recovery-email" className="text-sm font-medium text-[var(--text-primary)] dark:text-[var(--text-secondary)]">
                                Email
                            </label>
                            <input
                                id="recovery-email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="name@company.com"
                                className="w-full min-h-[44px] sm:min-h-[40px] border border-[var(--border)] rounded-lg px-3.5 py-2.5 text-base sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]/20 focus:border-[var(--focus)] transition-all duration-150 dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--text-primary)] dark:placeholder:text-[var(--text-secondary)] dark:focus:border-[var(--focus)]"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full min-h-11 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 active:brightness-90 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
                        >
                            {loading ? "Sending…" : "Send recovery email"}
                        </button>
                        <div className="text-center">
                            <Link href="/login" className="text-sm font-medium text-[var(--accent-link)] hover:underline">
                                Back to sign in
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </AuthLayout>
    );
}
