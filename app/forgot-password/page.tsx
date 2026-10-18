"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
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
        <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-slate-50 px-4 py-10 dark:bg-slate-950">
            <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6"><ThemeToggle /></div>
            <section className="relative z-10 flex w-full max-w-[420px] flex-col gap-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
                <header>
                    <p className="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">Account recovery</p>
                    <h1 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">Forgot your password?</h1>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">Enter your account email and we’ll send recovery instructions if an account matches.</p>
                </header>
                {submitted ? (
                    <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                        If an account matches that email, recovery instructions will be sent shortly.
                    </p>
                ) : (
                    <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <label htmlFor="recovery-email" className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                            Email
                            <input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                        </label>
                        <button type="submit" disabled={loading} className="min-h-11 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950">
                            {loading ? "Sending…" : "Send recovery email"}
                        </button>
                    </form>
                )}
                <Link href="/login" className="text-center text-sm font-medium text-teal-700 hover:underline dark:text-teal-400">Back to sign in</Link>
            </section>
        </main>
    );
}
