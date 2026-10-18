"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
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
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
            <section className="flex w-full max-w-[420px] flex-col gap-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
                <header>
                    <p className="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">Account recovery</p>
                    <h1 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">Choose a new password</h1>
                </header>
                {checking ? <p role="status" className="text-sm text-slate-500">Checking your recovery session…</p> : recoveryAvailable ? (
                    <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                            New password
                            <input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                        </label>
                        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                            Confirm new password
                            <input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                        </label>
                        <button type="submit" disabled={loading} className="min-h-11 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950">
                            {loading ? "Updating…" : "Update password"}
                        </button>
                    </form>
                ) : <Link href="/forgot-password" className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-400">Request a new recovery link</Link>}
                {feedback && <p role={feedback.kind === "error" ? "alert" : "status"} className={`text-sm ${feedback.kind === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>{feedback.message}</p>}
                {feedback?.kind === "success" && <Link href="/chat" className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-400">Continue to workspace</Link>}
                <Link href="/login" className="text-center text-sm text-slate-500 hover:underline dark:text-slate-400">Back to sign in</Link>
            </section>
        </main>
    );
}
