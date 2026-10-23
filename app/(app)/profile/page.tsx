"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PageFrame from "@/components/PageFrame";
import PageHeader from "@/components/PageHeader";
import { getProfileName, normalizeProfileName, PROFILE_NAME_MAX_LENGTH } from "@/lib/profile-name";

type UserInfo = {
    email: string;
    createdAt: string;
    fullName: string;
};

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [loggingOut, setLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordFeedback, setPasswordFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
    const [fullName, setFullName] = useState("");
    const [nameSaving, setNameSaving] = useState(false);
    const [nameFeedback, setNameFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

    useEffect(() => {
        const loadUser = async () => {
            const supabase = createClient();

            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (user) {
                setUser({
                    email: user.email ?? "",
                    createdAt: user.created_at,
                    fullName: getProfileName(user.user_metadata, user.email),
                });
                setFullName(getProfileName(user.user_metadata, user.email));
            }

            setLoading(false);
        };

        loadUser();
    }, []);

    const handleSaveProfileName = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setNameFeedback(null);
        const nextName = normalizeProfileName(fullName);
        if (!nextName) {
            setNameFeedback({ kind: "error", message: `Enter a name with 1–${PROFILE_NAME_MAX_LENGTH} characters.` });
            return;
        }

        setNameSaving(true);
        try {
            const supabase = createClient();
            const { data, error } = await supabase.auth.updateUser({ data: { full_name: nextName } });
            if (error || !data.user) {
                setNameFeedback({ kind: "error", message: "Unable to save your name. Please try again." });
                return;
            }

            const savedName = getProfileName(data.user.user_metadata, data.user.email);
            setFullName(savedName);
            setUser((current) => current ? { ...current, fullName: savedName } : current);
            setNameFeedback({ kind: "success", message: "Your name has been saved." });
        } catch {
            setNameFeedback({ kind: "error", message: "Unable to save your name. Please try again." });
        } finally {
            setNameSaving(false);
        }
    };

    const handleLogout = async () => {
        setLogoutError("");
        setLoggingOut(true);

        try {
            const supabase = createClient();
            const { error } = await supabase.auth.signOut();

            if (error) {
                console.error("Logout error:", error);
                setLogoutError("Failed to log out. Please try again.");
                setLoggingOut(false);
                return;
            }

            router.push("/");
        } catch (error) {
            console.error("Logout error:", error);
            setLogoutError("Failed to log out. Please try again.");
            setLoggingOut(false);
        }
    };

    const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setPasswordFeedback(null);

        if (newPassword.length < 8) {
            setPasswordFeedback({ kind: "error", message: "Use a new password with at least 8 characters." });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordFeedback({ kind: "error", message: "The new passwords do not match." });
            return;
        }
        if (newPassword === currentPassword) {
            setPasswordFeedback({ kind: "error", message: "Choose a new password different from your current one." });
            return;
        }

        setPasswordSaving(true);
        try {
            const supabase = createClient();
            const { data: userData, error: userError } = await supabase.auth.getUser();
            const email = userData.user?.email;
            if (userError || !email) {
                setPasswordFeedback({ kind: "error", message: "Your session could not be verified. Sign in again and retry." });
                return;
            }

            // Supabase JS 2.112.3 has no current-password argument on updateUser.
            // Reauthenticate this identity before updating the password.
            const { error: verificationError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
            if (verificationError) {
                setPasswordFeedback({ kind: "error", message: "The current password could not be verified." });
                return;
            }

            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
            if (updateError) {
                setPasswordFeedback({ kind: "error", message: "Unable to update the password. Check the new password and try again." });
                return;
            }

            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setPasswordFeedback({ kind: "success", message: "Your password has been changed." });
        } catch {
            setPasswordFeedback({ kind: "error", message: "Unable to change your password right now. Please try again." });
        } finally {
            setPasswordSaving(false);
        }
    };

    /* ── Helpers ───────────────────────────────── */

    const getInitials = (email: string) => {
        return (user?.fullName || email || "U").charAt(0).toUpperCase();
    };

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
            });
        } catch {
            return "—";
        }
    };

    /* ── Skeleton ──────────────────────────────── */

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center bg-[var(--background)]">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-teal-600 dark:border-[var(--border)] dark:border-t-teal-400" />
            </div>
        );
    }

    return (
        <PageFrame>
            <div className="mx-auto max-w-2xl">
                {/* ── Page heading ─────────────────── */}
                <PageHeader
                    eyebrow="Account"
                    title="Profile"
                    description="Manage the name shown on your account and your sign-in options."
                />

                {/* ── Profile card ─────────────────── */}
                <section className="border-b border-[var(--border)] pb-7">
                    <div className="flex items-center gap-4 sm:gap-5">
                        {/* Avatar */}
                        <div
                            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] sm:h-16 sm:w-16"
                            aria-hidden="true"
                        >
                            <span className="text-xl font-bold text-[var(--accent)]">
                                {user ? getInitials(user.email) : "U"}
                            </span>
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                            <h2 className="text-lg font-semibold text-[var(--text-primary)] truncate dark:text-[var(--text-primary)]">
                                {user?.fullName ?? "User"}
                            </h2>
                            <p className="mt-0.5 text-sm text-[var(--text-secondary)] truncate dark:text-[var(--text-secondary)]">
                                {user?.email ?? "No email available"}
                            </p>

                        </div>
                    </div>
                </section>

                {/* ── Account details ──────────────── */}
                <section className="mt-8">
                    <div className="mb-3">
                        <h3 className="text-base font-semibold text-[var(--text-primary)]">
                            Account information
                        </h3>
                    </div>

                    <dl className="border-y border-[var(--border)] divide-y divide-[var(--border)]">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 py-3 sm:px-6 sm:py-3.5 gap-0.5 sm:gap-4">
                            <dt className="text-xs sm:text-sm text-[var(--text-secondary)] shrink-0 dark:text-[var(--text-secondary)]">Email</dt>
                            <dd className="text-sm font-medium text-[var(--text-primary)] truncate max-w-full dark:text-[var(--text-primary)]">
                                {user?.email ?? "—"}
                            </dd>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 py-3 sm:px-6 sm:py-3.5 gap-0.5 sm:gap-4">
                            <dt className="text-xs sm:text-sm text-[var(--text-secondary)] shrink-0 dark:text-[var(--text-secondary)]">
                                Member since
                            </dt>
                            <dd className="text-sm font-medium text-[var(--text-primary)] dark:text-[var(--text-primary)]">
                                {user?.createdAt
                                    ? formatDate(user.createdAt)
                                    : "—"}
                            </dd>
                        </div>
                    </dl>
                </section>

                <section className="mt-8 border-b border-[var(--border)] pb-7">
                    <div className="mb-4">
                        <h3 className="text-base font-semibold text-[var(--text-primary)]">Profile details</h3>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">Your name appears on your account. Email is read-only here.</p>
                    </div>
                    <form onSubmit={handleSaveProfileName} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <label htmlFor="profile-full-name" className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium text-[var(--text-primary)]">
                            Full name
                            <input id="profile-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={PROFILE_NAME_MAX_LENGTH} autoComplete="name" required className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-base text-[var(--text-primary)] outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20" />
                        </label>
                        <button type="submit" disabled={nameSaving} className="min-h-11 shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-wait disabled:opacity-60">
                            {nameSaving ? "Saving…" : "Save name"}
                        </button>
                        {nameFeedback && <p role={nameFeedback.kind === "error" ? "alert" : "status"} className={`text-sm sm:basis-full ${nameFeedback.kind === "error" ? "text-[var(--error)]" : "text-[var(--success)]"}`}>{nameFeedback.message}</p>}
                    </form>
                </section>

                <section className="mt-8 border-b border-[var(--border)] pb-7">
                    <div className="mb-4">
                        <h3 className="text-base font-semibold text-[var(--text-primary)]">Change Password</h3>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">Confirm your current password before choosing a new one.</p>
                    </div>
                    <form method="post" onSubmit={handleChangePassword} className="grid gap-4 sm:grid-cols-2">
                        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-primary)] sm:col-span-2">
                            Current password
                            <input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-base text-[var(--text-primary)] outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20" />
                        </label>
                        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-primary)]">
                            New password
                            <input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-base text-[var(--text-primary)] outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20" />
                        </label>
                        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-primary)]">
                            Confirm new password
                            <input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-base text-[var(--text-primary)] outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20" />
                        </label>
                        {passwordFeedback && <p role={passwordFeedback.kind === "error" ? "alert" : "status"} className={`text-sm sm:col-span-2 ${passwordFeedback.kind === "error" ? "text-[var(--error)] dark:text-[var(--error)]" : "text-[var(--success)] dark:text-[var(--success)]"}`}>{passwordFeedback.message}</p>}
                        <div className="sm:col-span-2">
                            <button type="submit" disabled={passwordSaving} className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-wait disabled:opacity-60">
                                {passwordSaving ? "Updating…" : "Update password"}
                            </button>
                        </div>
                    </form>
                </section>

                {/* ── Quick links ──────────────────── */}
                <section className="mt-8">
                    <div className="mb-3">
                        <h3 className="text-base font-semibold text-[var(--text-primary)]">
                            Quick Links
                        </h3>
                    </div>

                    <div className="border-y border-[var(--border)] divide-y divide-[var(--border)]">
                        <Link
                            href="/settings"
                            className="flex min-h-[44px] items-center justify-between px-5 py-3 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--background)] hover:text-[var(--text-primary)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--surface-muted)] dark:hover:text-[var(--text-primary)] sm:px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus)]"
                        >
                            <span className="flex items-center gap-2.5">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                </svg>
                                Settings
                            </span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-300 dark:text-[var(--text-secondary)]">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </Link>

                        <Link
                            href="/upload"
                            className="flex min-h-[44px] items-center justify-between px-5 py-3 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--background)] hover:text-[var(--text-primary)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--surface-muted)] dark:hover:text-[var(--text-primary)] sm:px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus)]"
                        >
                            <span className="flex items-center gap-2.5">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                                Knowledge Base
                            </span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-300 dark:text-[var(--text-secondary)]">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </Link>
                    </div>
                </section>

                {/* ── Logout ──────────────────────── */}
                <section className="mt-6 mb-10">
                    {logoutError && (
                        <p role="alert" aria-live="assertive" className="mb-3 text-center text-sm text-[var(--error)] dark:text-[var(--error)]">
                            {logoutError}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-[color-mix(in_srgb,var(--error)_25%,var(--border))] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--error)] shadow-sm transition-all duration-150 hover:border-[color-mix(in_srgb,var(--error)_45%,var(--border))] hover:bg-[var(--error-soft)] dark:border-[color-mix(in_srgb,var(--error)_35%,var(--border))] dark:bg-[var(--surface)] dark:text-[var(--error)] dark:hover:border-red-800 dark:hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Log out of your account"
                    >
                        {loggingOut ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[color-mix(in_srgb,var(--error)_45%,var(--border))] border-t-red-600 dark:border-red-500 dark:border-t-red-400" />
                                Logging out…
                            </>
                        ) : (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                                Log out
                            </>
                        )}
                    </button>
                </section>
            </div>
        </PageFrame>
    );
}
