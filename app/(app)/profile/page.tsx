"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type UserInfo = {
    email: string;
    createdAt: string;
};

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [loggingOut, setLoggingOut] = useState(false);

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
                });
            }

            setLoading(false);
        };

        loadUser();
    }, []);

    const handleLogout = async () => {
        setLoggingOut(true);

        try {
            const supabase = createClient();
            const { error } = await supabase.auth.signOut();

            if (error) {
                console.error("Logout error:", error);
                window.alert("Failed to log out. Please try again.");
                setLoggingOut(false);
                return;
            }

            router.push("/");
        } catch (error) {
            console.error("Logout error:", error);
            window.alert("Failed to log out. Please try again.");
            setLoggingOut(false);
        }
    };

    /* ── Helpers ───────────────────────────────── */

    const getInitials = (email: string) => {
        if (!email) return "U";
        return email.charAt(0).toUpperCase();
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
            <div className="flex flex-1 items-center justify-center bg-slate-50">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600" />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-10 sm:px-6">
            <div className="mx-auto max-w-2xl">
                {/* ── Page heading ─────────────────── */}
                <header className="mb-8">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        Profile
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Your account details and preferences.
                    </p>
                </header>

                {/* ── Profile card ─────────────────── */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                    <div className="flex flex-col items-center sm:flex-row sm:items-start sm:gap-6">
                        {/* Avatar */}
                        <div
                            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 shadow-md"
                            aria-hidden="true"
                        >
                            <span className="text-2xl font-bold text-white">
                                {user ? getInitials(user.email) : "U"}
                            </span>
                        </div>

                        {/* Info */}
                        <div className="mt-4 flex-1 text-center sm:mt-0 sm:text-left">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {user?.email
                                    ? user.email.split("@")[0]
                                    : "User"}
                            </h2>
                            <p className="mt-0.5 text-sm text-slate-500">
                                {user?.email ?? "No email available"}
                            </p>

                            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    Active
                                </span>

                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                                    Free plan
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Account details ──────────────── */}
                <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-6 py-4 sm:px-8">
                        <h3 className="text-sm font-semibold text-slate-900">
                            Account Information
                        </h3>
                    </div>

                    <dl className="divide-y divide-slate-100">
                        <div className="flex items-center justify-between px-6 py-3.5 sm:px-8">
                            <dt className="text-sm text-slate-500">Email</dt>
                            <dd className="text-sm font-medium text-slate-900">
                                {user?.email ?? "—"}
                            </dd>
                        </div>

                        <div className="flex items-center justify-between px-6 py-3.5 sm:px-8">
                            <dt className="text-sm text-slate-500">Status</dt>
                            <dd className="text-sm font-medium text-emerald-600">
                                Active
                            </dd>
                        </div>

                        <div className="flex items-center justify-between px-6 py-3.5 sm:px-8">
                            <dt className="text-sm text-slate-500">
                                Member since
                            </dt>
                            <dd className="text-sm font-medium text-slate-900">
                                {user?.createdAt
                                    ? formatDate(user.createdAt)
                                    : "—"}
                            </dd>
                        </div>

                        <div className="flex items-center justify-between px-6 py-3.5 sm:px-8">
                            <dt className="text-sm text-slate-500">Plan</dt>
                            <dd className="text-sm font-medium text-slate-900">
                                Free
                            </dd>
                        </div>
                    </dl>
                </section>

                {/* ── Quick links ──────────────────── */}
                <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-6 py-4 sm:px-8">
                        <h3 className="text-sm font-semibold text-slate-900">
                            Quick Links
                        </h3>
                    </div>

                    <div className="divide-y divide-slate-100">
                        <Link
                            href="/settings"
                            className="flex items-center justify-between px-6 py-3.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:px-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
                        >
                            <span className="flex items-center gap-2.5">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-400">
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                </svg>
                                Settings
                            </span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-300">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </Link>

                        <Link
                            href="/upload"
                            className="flex items-center justify-between px-6 py-3.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:px-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
                        >
                            <span className="flex items-center gap-2.5">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-400">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                                Knowledge Base
                            </span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-300">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </Link>
                    </div>
                </section>

                {/* ── Logout ──────────────────────── */}
                <section className="mt-6 mb-10">
                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-600 shadow-sm transition-all duration-150 hover:border-red-300 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Log out of your account"
                    >
                        {loggingOut ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600" />
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
        </div>
    );
}
