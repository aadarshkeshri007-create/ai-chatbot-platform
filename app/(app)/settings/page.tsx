"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useTheme, Theme } from "@/components/ThemeProvider";
import { createClient } from "@/lib/supabase/client";
import { logSupabaseError } from "@/lib/supabase/error";
import {
    ASSISTANT_SETTINGS_LIMITS,
    DEFAULT_ASSISTANT_NAME,
    DEFAULT_BUSINESS_NAME,
    DEFAULT_WELCOME_MESSAGE,
    getAssistantSettings,
} from "@/lib/assistant-settings";

/* ── Types ─────────────────────────────────────── */

type ResponseLength = "short" | "balanced" | "detailed";
type ResponseStyle = "balanced" | "formal" | "friendly";

export default function SettingsPage() {
    /* ── Connected Theme State ─────────────────── */
    const { theme, setTheme } = useTheme();

    /* ── Local-only state ──────────────────────── */
    const [language] = useState("English");
    const [responseStyle, setResponseStyle] = useState<ResponseStyle>("balanced");

    const [emailNotifications, setEmailNotifications] = useState(true);
    const [productUpdates, setProductUpdates] = useState(false);

    const [responseLength, setResponseLength] = useState<ResponseLength>("balanced");
    const [useKnowledgeBase, setUseKnowledgeBase] = useState(true);
    const [businessName, setBusinessName] = useState(DEFAULT_BUSINESS_NAME);
    const [assistantName, setAssistantName] = useState(DEFAULT_ASSISTANT_NAME);
    const [welcomeMessage, setWelcomeMessage] = useState(DEFAULT_WELCOME_MESSAGE);
    const [customInstructions, setCustomInstructions] = useState("");
    const [identityLoading, setIdentityLoading] = useState(true);
    const [identitySaving, setIdentitySaving] = useState(false);
    const [identityError, setIdentityError] = useState("");
    const [identitySuccess, setIdentitySuccess] = useState("");

    useEffect(() => {
        const loadAssistantSettings = async () => {
            const supabase = createClient();
            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError || !user) {
                setIdentityError("Unable to load your assistant settings.");
                setIdentityLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from("profiles")
                .select("business_name, assistant_name, welcome_message, custom_instructions")
                .eq("id", user.id)
                .maybeSingle();

            if (error) {
                logSupabaseError("Assistant settings load error:", error);
                setIdentityError("Unable to load your assistant settings.");
            } else {
                const settings = getAssistantSettings(data);
                setBusinessName(settings.businessName);
                setAssistantName(settings.assistantName);
                setWelcomeMessage(settings.welcomeMessage);
                setCustomInstructions(settings.customInstructions);
            }

            setIdentityLoading(false);
        };

        loadAssistantSettings();
    }, []);

    const handleAssistantSettingsSave = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIdentityError("");
        setIdentitySuccess("");

        const nextBusinessName = businessName.trim();
        const nextAssistantName = assistantName.trim();
        const nextWelcomeMessage = welcomeMessage.trim();
        const nextCustomInstructions = customInstructions.trim();

        if (!nextBusinessName || !nextAssistantName || !nextWelcomeMessage) {
            setIdentityError("All assistant identity fields are required.");
            return;
        }

        setIdentitySaving(true);

        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            setIdentityError("Your session has expired. Please sign in again.");
            setIdentitySaving(false);
            return;
        }

        const { data, error } = await supabase
            .from("profiles")
            .update({
                business_name: nextBusinessName,
                assistant_name: nextAssistantName,
                welcome_message: nextWelcomeMessage,
                custom_instructions: nextCustomInstructions,
            })
            .eq("id", user.id)
            .select("business_name, assistant_name, welcome_message, custom_instructions")
            .maybeSingle();

        if (error) {
            logSupabaseError("Assistant settings save error:", error);
            setIdentityError("Unable to save your assistant settings. Please try again.");
        } else if (!data) {
            console.error("Assistant settings save error: profile row not found", {
                userId: user.id,
            });
            setIdentityError("Your profile could not be found. Please try again after the database migration is applied.");
        } else {
            setBusinessName(nextBusinessName);
            setAssistantName(nextAssistantName);
            setWelcomeMessage(nextWelcomeMessage);
            setCustomInstructions(nextCustomInstructions);
            setIdentitySuccess("Assistant identity saved.");
        }

        setIdentitySaving(false);
    };

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
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
                    checked ? "bg-teal-600 dark:bg-teal-500" : "bg-slate-200 dark:bg-slate-700"
                }`}
            >
                <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                        checked ? "translate-x-4" : "translate-x-0"
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
            <div className="flex flex-wrap gap-1.5">
                {options.map((option) => (
                    <label
                        key={option.value}
                        className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-150 focus-within:ring-2 focus-within:ring-teal-500 focus-within:ring-offset-2 ${
                            value === option.value
                                ? "border-teal-300 bg-teal-50 text-teal-700 shadow-sm dark:border-teal-600 dark:bg-teal-950/40 dark:text-teal-300"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700/60"
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
        <div className="h-full min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8 dark:bg-slate-950 transition-colors duration-150">
            <div className="mx-auto w-full max-w-5xl">
                {/* ── Fixed Header ─────────────────── */}
                <header className="mb-3.5 shrink-0">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        Settings
                    </h1>
                    <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                        Customize your experience and your assistant identity.
                    </p>
                </header>

                <form onSubmit={handleAssistantSettingsSave} className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                            Assistant identity
                        </h2>
                        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                            These details appear in your chat and guide your AI assistant.
                        </p>
                    </div>

                    <fieldset disabled={identityLoading || identitySaving} className="grid gap-3 p-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="business-name" className="text-xs font-medium text-slate-700 dark:text-slate-300">Business Name</label>
                            <input id="business-name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} maxLength={ASSISTANT_SETTINGS_LIMITS.businessName} required className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                        </div>
                        <div>
                            <label htmlFor="assistant-name" className="text-xs font-medium text-slate-700 dark:text-slate-300">Assistant Name</label>
                            <input id="assistant-name" value={assistantName} onChange={(event) => setAssistantName(event.target.value)} maxLength={ASSISTANT_SETTINGS_LIMITS.assistantName} required className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                        </div>
                        <div className="sm:col-span-2">
                            <label htmlFor="welcome-message" className="text-xs font-medium text-slate-700 dark:text-slate-300">Welcome Message</label>
                            <textarea id="welcome-message" value={welcomeMessage} onChange={(event) => setWelcomeMessage(event.target.value)} maxLength={ASSISTANT_SETTINGS_LIMITS.welcomeMessage} required rows={2} className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                        </div>
                        <div className="sm:col-span-2">
                            <label htmlFor="custom-instructions" className="text-xs font-medium text-slate-700 dark:text-slate-300">Custom Instructions</label>
                            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Tell the assistant how it should behave when answering customers.</p>
                            <textarea id="custom-instructions" value={customInstructions} onChange={(event) => setCustomInstructions(event.target.value)} maxLength={ASSISTANT_SETTINGS_LIMITS.customInstructions} rows={4} className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                            <p className="mt-1 text-right text-[11px] text-slate-400 dark:text-slate-500">{customInstructions.length}/{ASSISTANT_SETTINGS_LIMITS.customInstructions}</p>
                        </div>
                        <div className="flex min-h-9 items-center sm:col-span-2">
                            {identityLoading && <p className="text-xs text-slate-500 dark:text-slate-400">Loading assistant settings…</p>}
                            {identityError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{identityError}</p>}
                            {identitySuccess && <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400">{identitySuccess}</p>}
                        </div>
                        <div className="flex justify-end sm:col-span-2">
                            <button type="submit" disabled={identityLoading || identitySaving} className="rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
                                {identitySaving ? "Saving…" : "Save assistant identity"}
                            </button>
                        </div>
                    </fieldset>
                </form>

                {/* ── 2-Column Compact Grid (Fits 100% within viewport, completely unscrollable) ── */}
                <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2 lg:gap-4">
                    {/* LEFT COLUMN */}
                    <div className="flex flex-col gap-3.5">
                        {/* 1. GENERAL */}
                        <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                            <div className="border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                    General
                                </h2>
                            </div>

                            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                {/* Theme */}
                                <div className="flex items-center justify-between px-4 py-2.5">
                                    <div>
                                        <label className="font-medium text-slate-700 dark:text-slate-300">
                                            Theme
                                        </label>
                                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                            Preferred appearance
                                        </p>
                                    </div>
                                    <RadioGroup<Theme>
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
                                <div className="flex items-center justify-between px-4 py-2.5">
                                    <div>
                                        <label className="font-medium text-slate-700 dark:text-slate-300">
                                            Language
                                        </label>
                                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                            Interface language
                                        </p>
                                    </div>
                                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                        {language}
                                    </span>
                                </div>

                                {/* Response style */}
                                <div className="flex items-center justify-between px-4 py-2.5">
                                    <div>
                                        <label className="font-medium text-slate-700 dark:text-slate-300">
                                            Response style
                                        </label>
                                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                            AI assistant tone
                                        </p>
                                    </div>
                                    <RadioGroup<ResponseStyle>
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

                        {/* 2. NOTIFICATIONS */}
                        <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                            <div className="border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                    Notifications
                                </h2>
                            </div>

                            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                <div className="flex items-center justify-between px-4 py-2.5">
                                    <div>
                                        <label
                                            htmlFor="toggle-email-notifications"
                                            className="font-medium text-slate-700 dark:text-slate-300"
                                        >
                                            Email notifications
                                        </label>
                                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                            Conversation updates
                                        </p>
                                    </div>
                                    <Toggle
                                        id="toggle-email-notifications"
                                        checked={emailNotifications}
                                        onChange={setEmailNotifications}
                                        label="Toggle email notifications"
                                    />
                                </div>

                                <div className="flex items-center justify-between px-4 py-2.5">
                                    <div>
                                        <label
                                            htmlFor="toggle-product-updates"
                                            className="font-medium text-slate-700 dark:text-slate-300"
                                        >
                                            Product updates
                                        </label>
                                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                            Feature announcements
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
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="flex flex-col gap-3.5">
                        {/* 3. AI PREFERENCES */}
                        <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                            <div className="border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                    AI Preferences
                                </h2>
                            </div>

                            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                <div className="flex items-center justify-between px-4 py-2.5">
                                    <div>
                                        <label className="font-medium text-slate-700 dark:text-slate-300">
                                            Response length
                                        </label>
                                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                            Detail level of answers
                                        </p>
                                    </div>
                                    <RadioGroup<ResponseLength>
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

                                <div className="flex items-center justify-between px-4 py-2.5">
                                    <div>
                                        <label
                                            htmlFor="toggle-knowledge-base"
                                            className="font-medium text-slate-700 dark:text-slate-300"
                                        >
                                            Use knowledge base
                                        </label>
                                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                            Reference uploaded files
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

                        {/* 4. ACCOUNT */}
                        <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                            <div className="border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                    Account
                                </h2>
                            </div>

                            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                <Link
                                    href="/profile"
                                    className="flex items-center justify-between px-4 py-2.5 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
                                >
                                    <span className="flex items-center gap-2 font-medium">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-400 dark:text-slate-500">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                        Profile Details
                                    </span>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </Link>

                                <Link
                                    href="/profile"
                                    className="flex items-center justify-between px-4 py-2.5 text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500"
                                >
                                    <span className="flex items-center gap-2 font-medium">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                            <polyline points="16 17 21 12 16 7" />
                                            <line x1="21" y1="12" x2="9" y2="12" />
                                        </svg>
                                        Log out
                                    </span>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-red-300 dark:text-red-500/60">
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </Link>
                            </div>
                        </section>
                    </div>
                </div>

                {/* ── Notice Footer ────────────── */}
                <div className="mt-3 shrink-0 rounded-lg border border-slate-200 bg-white/70 px-3.5 py-2 text-center text-[11px] text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-500">
                    Assistant identity is securely synced to your account. Other settings are stored locally in your browser.
                </div>
            </div>
        </div>
    );
}
