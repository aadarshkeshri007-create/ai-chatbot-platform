"use client";

import { useState } from "react";
import Link from "next/link";

/* ── Types ─────────────────────────────────────── */

type ThemeOption = "system" | "light" | "dark";
type ResponseLength = "short" | "balanced" | "detailed";
type ResponseStyle = "balanced" | "formal" | "friendly";

export default function SettingsPage() {
    /* ── Local-only state ──────────────────────── */
    const [theme, setTheme] = useState<ThemeOption>("system");
    const [language] = useState("English");
    const [responseStyle, setResponseStyle] = useState<ResponseStyle>("balanced");

    const [emailNotifications, setEmailNotifications] = useState(true);
    const [productUpdates, setProductUpdates] = useState(false);

    const [responseLength, setResponseLength] = useState<ResponseLength>("balanced");
    const [useKnowledgeBase, setUseKnowledgeBase] = useState(true);

    /* ── Reusable toggle ──────────────────────── */
    function Toggle({
        id,
        checked,
        onChange,
        label,
    }: {
        id: string;
        checked: boolean;
        onChange: (v: boolean) => void;
        label: string;
    }) {
        return (
            <button
                id={id}
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                onClick={() => onChange(!checked)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
                    checked ? "bg-teal-600" : "bg-slate-200"
                }`}
            >
                <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-4.5 w-4.5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                        checked ? "translate-x-5" : "translate-x-0.5"
                    }`}
                />
            </button>
        );
    }

    /* ── Reusable radio group ─────────────────── */
    function RadioGroup<T extends string>({
        name,
        options,
        value,
        onChange,
    }: {
        name: string;
        options: { value: T; label: string }[];
        value: T;
        onChange: (v: T) => void;
    }) {
        return (
            <div className="flex flex-wrap gap-2">
                {options.map((option) => (
                    <label
                        key={option.value}
                        className={`cursor-pointer rounded-lg border px-3.5 py-2 text-xs font-medium transition-all duration-150 focus-within:ring-2 focus-within:ring-teal-500 focus-within:ring-offset-2 ${
                            value === option.value
                                ? "border-teal-300 bg-teal-50 text-teal-700 shadow-sm"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={value === option.value}
                            onChange={() => onChange(option.value)}
                            className="sr-only"
                        />
                        {option.label}
                    </label>
                ))}
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-10 sm:px-6">
            <div className="mx-auto max-w-2xl">
                {/* ── Page heading ─────────────────── */}
                <header className="mb-8">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        Settings
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Customize your experience. Settings are stored locally and not yet synced to your account.
                    </p>
                </header>

                {/* ═══════════════════════════════════ */}
                {/* GENERAL                            */}
                {/* ═══════════════════════════════════ */}
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-6 py-4 sm:px-8">
                        <h2 className="text-sm font-semibold text-slate-900">
                            General
                        </h2>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {/* Theme */}
                        <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    Theme
                                </label>
                                <p className="mt-0.5 text-xs text-slate-400">
                                    Choose your preferred appearance.
                                </p>
                            </div>
                            <RadioGroup
                                name="theme"
                                value={theme}
                                onChange={setTheme}
                                options={[
                                    { value: "system", label: "System" },
                                    { value: "light", label: "Light" },
                                    { value: "dark", label: "Dark" },
                                ]}
                            />
                        </div>

                        {/* Language */}
                        <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    Language
                                </label>
                                <p className="mt-0.5 text-xs text-slate-400">
                                    Interface language.
                                </p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-600">
                                {language}
                            </span>
                        </div>

                        {/* Response style */}
                        <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    Response style
                                </label>
                                <p className="mt-0.5 text-xs text-slate-400">
                                    Adjust the AI's tone.
                                </p>
                            </div>
                            <RadioGroup
                                name="response-style"
                                value={responseStyle}
                                onChange={setResponseStyle}
                                options={[
                                    { value: "formal", label: "Formal" },
                                    { value: "balanced", label: "Balanced" },
                                    { value: "friendly", label: "Friendly" },
                                ]}
                            />
                        </div>
                    </div>
                </section>

                {/* ═══════════════════════════════════ */}
                {/* NOTIFICATIONS                      */}
                {/* ═══════════════════════════════════ */}
                <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-6 py-4 sm:px-8">
                        <h2 className="text-sm font-semibold text-slate-900">
                            Notifications
                        </h2>
                    </div>

                    <div className="divide-y divide-slate-100">
                        <div className="flex items-center justify-between px-6 py-4 sm:px-8">
                            <div>
                                <label
                                    htmlFor="toggle-email-notifications"
                                    className="text-sm font-medium text-slate-700"
                                >
                                    Email notifications
                                </label>
                                <p className="mt-0.5 text-xs text-slate-400">
                                    Receive email updates about your conversations.
                                </p>
                            </div>
                            <Toggle
                                id="toggle-email-notifications"
                                checked={emailNotifications}
                                onChange={setEmailNotifications}
                                label="Toggle email notifications"
                            />
                        </div>

                        <div className="flex items-center justify-between px-6 py-4 sm:px-8">
                            <div>
                                <label
                                    htmlFor="toggle-product-updates"
                                    className="text-sm font-medium text-slate-700"
                                >
                                    Product updates
                                </label>
                                <p className="mt-0.5 text-xs text-slate-400">
                                    Get notified about new features and improvements.
                                </p>
                            </div>
                            <Toggle
                                id="toggle-product-updates"
                                checked={productUpdates}
                                onChange={setProductUpdates}
                                label="Toggle product updates"
                            />
                        </div>
                    </div>
                </section>

                {/* ═══════════════════════════════════ */}
                {/* AI PREFERENCES                     */}
                {/* ═══════════════════════════════════ */}
                <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-6 py-4 sm:px-8">
                        <h2 className="text-sm font-semibold text-slate-900">
                            AI Preferences
                        </h2>
                    </div>

                    <div className="divide-y divide-slate-100">
                        <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                            <div>
                                <label className="text-sm font-medium text-slate-700">
                                    Response length
                                </label>
                                <p className="mt-0.5 text-xs text-slate-400">
                                    How detailed should AI responses be?
                                </p>
                            </div>
                            <RadioGroup
                                name="response-length"
                                value={responseLength}
                                onChange={setResponseLength}
                                options={[
                                    { value: "short", label: "Short" },
                                    { value: "balanced", label: "Balanced" },
                                    { value: "detailed", label: "Detailed" },
                                ]}
                            />
                        </div>

                        <div className="flex items-center justify-between px-6 py-4 sm:px-8">
                            <div>
                                <label
                                    htmlFor="toggle-knowledge-base"
                                    className="text-sm font-medium text-slate-700"
                                >
                                    Use knowledge base
                                </label>
                                <p className="mt-0.5 text-xs text-slate-400">
                                    Allow the AI to reference your uploaded documents.
                                </p>
                            </div>
                            <Toggle
                                id="toggle-knowledge-base"
                                checked={useKnowledgeBase}
                                onChange={setUseKnowledgeBase}
                                label="Toggle knowledge base usage"
                            />
                        </div>
                    </div>
                </section>

                {/* ═══════════════════════════════════ */}
                {/* ACCOUNT                            */}
                {/* ═══════════════════════════════════ */}
                <section className="mt-6 mb-10 rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-6 py-4 sm:px-8">
                        <h2 className="text-sm font-semibold text-slate-900">
                            Account
                        </h2>
                    </div>

                    <div className="divide-y divide-slate-100">
                        <Link
                            href="/profile"
                            className="flex items-center justify-between px-6 py-3.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:px-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
                        >
                            <span className="flex items-center gap-2.5">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-400">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                                Profile
                            </span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-300">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </Link>

                        <Link
                            href="/profile"
                            className="flex items-center justify-between px-6 py-3.5 text-sm text-red-600 transition-colors hover:bg-red-50 sm:px-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500"
                        >
                            <span className="flex items-center gap-2.5">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                                Log out
                            </span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-red-300">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </Link>
                    </div>
                </section>

                {/* ── Local-only notice ────────────── */}
                <div className="mb-10 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-center text-xs text-slate-400">
                    These settings are stored locally in your browser and are not yet synced to your account.
                </div>
            </div>
        </div>
    );
}
