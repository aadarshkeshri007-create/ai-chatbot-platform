"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useTheme, Theme } from "@/components/ThemeProvider";
import { createClient } from "@/lib/supabase/client";
import { isMissingSchemaFieldError, logSupabaseError } from "@/lib/supabase/error";
import {
    ASSISTANT_SETTINGS_LIMITS,
    DEFAULT_ASSISTANT_NAME,
    DEFAULT_BUSINESS_NAME,
    DEFAULT_WELCOME_MESSAGE,
    MAX_SUGGESTED_QUESTIONS,
    getAssistantSettings,
    parseSuggestedQuestions,
} from "@/lib/assistant-settings";
import { normalizeAllowedDomainInput } from "@/lib/public-chat-origin";
import PageFrame from "@/components/PageFrame";
import PageHeader from "@/components/PageHeader";

/* ── Types ─────────────────────────────────────── */

type ResponseLength = "short" | "balanced" | "detailed";
type ResponseStyle = "balanced" | "formal" | "friendly";

function Toggle({
    id,
    checked,
    onChange,
    label,
}: {
    id: string;
    checked: boolean;
    onChange: (value: boolean) => void;
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

function RadioGroup<T extends string>({
    name,
    options,
    value,
    onChange,
}: {
    name: string;
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
}) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {options.map((option) => (
                <label
                    key={option.value}
                    className={`relative inline-flex items-center cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-150 focus-within:ring-2 focus-within:ring-teal-500 focus-within:ring-offset-2 ${
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
                        className="absolute inset-0 h-full w-full opacity-0"
                    />
                    {option.label}
                </label>
            ))}
        </div>
    );
}

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
    const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
    const [suggestedQuestionsAvailable, setSuggestedQuestionsAvailable] = useState(true);
    const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
    const [newAllowedDomain, setNewAllowedDomain] = useState("");
    const [allowedDomainsAvailable, setAllowedDomainsAvailable] = useState(true);
    const [allowedDomainsError, setAllowedDomainsError] = useState("");
    const [assistantId, setAssistantId] = useState<string | null>(null);
    const [assistantIdError, setAssistantIdError] = useState("");
    const [assistantIdCopyStatus, setAssistantIdCopyStatus] = useState("");
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
                setAssistantIdError("Unable to load your Assistant ID.");
                setIdentityLoading(false);
                return;
            }

            let { data, error } = await supabase
                .from("profiles")
                .select("business_name, assistant_name, welcome_message, custom_instructions, suggested_questions, allowed_domains")
                .eq("id", user.id)
                .maybeSingle();

            if (isMissingSchemaFieldError(error)) {
                // suggested_questions ships in its own migration. Until that
                // migration is applied, keep the rest of the settings working.
                console.warn(
                    "Assistant settings: suggested_questions is not available, hiding suggested questions.",
                    { code: error?.code, message: error?.message },
                );
                setSuggestedQuestionsAvailable(false);
                ({ data, error } = await supabase
                    .from("profiles")
                    .select("business_name, assistant_name, welcome_message, custom_instructions, allowed_domains")
                    .eq("id", user.id)
                    .maybeSingle());
            }

            if (isMissingSchemaFieldError(error)) {
            setAllowedDomainsAvailable(false);
            ({ data, error } = await supabase
                .from("profiles")
                .select("business_name, assistant_name, welcome_message, custom_instructions")
                .eq("id", user.id)
                .maybeSingle());
            }

            if (error) {
                logSupabaseError("Assistant settings load error:", error);
                setIdentityError("Unable to load your assistant settings.");
            } else {
                const settings = getAssistantSettings(data);
                setBusinessName(settings.businessName);
                setAssistantName(settings.assistantName);
                setWelcomeMessage(settings.welcomeMessage);
                setCustomInstructions(settings.customInstructions);
                setSuggestedQuestions(parseSuggestedQuestions(data?.suggested_questions));
                setAllowedDomains(
                    Array.isArray(data?.allowed_domains)
                        ? data.allowed_domains.filter(
                            (domain): domain is string => typeof domain === "string",
                        )
                        : [],
                );
            }

            const { data: profile, error: assistantIdLoadError } = await supabase
                .from("profiles")
                .select("assistant_id")
                .eq("id", user.id)
                .maybeSingle();

            if (assistantIdLoadError) {
                if (isMissingSchemaFieldError(assistantIdLoadError)) {
                    console.warn(
                        "Assistant ID is unavailable until its database migration is applied.",
                        { code: assistantIdLoadError.code, message: assistantIdLoadError.message },
                    );
                    setAssistantIdError(
                        "Your Assistant ID will appear after the database migration is applied.",
                    );
                } else {
                    logSupabaseError("Assistant ID load error:", assistantIdLoadError);
                    setAssistantIdError("Unable to load your Assistant ID.");
                }
            } else if (!profile?.assistant_id) {
                setAssistantIdError("No Assistant ID is available for your profile yet.");
            } else {
                setAssistantId(profile.assistant_id);
            }

            setIdentityLoading(false);
        };

        loadAssistantSettings();
    }, []);

    const handleCopyAssistantId = async () => {
        if (!assistantId) return;

        try {
            await navigator.clipboard.writeText(assistantId);
            setAssistantIdCopyStatus("Assistant ID copied.");
        } catch {
            setAssistantIdCopyStatus(
                "Unable to copy the Assistant ID. Please copy it manually.",
            );
        }
    };

    const handleSuggestedQuestionChange = (index: number, value: string) => {
        setSuggestedQuestions((current) =>
            current.map((question, position) => (position === index ? value : question)),
        );
    };

    const handleAddSuggestedQuestion = () => {
        setSuggestedQuestions((current) =>
            current.length >= MAX_SUGGESTED_QUESTIONS ? current : [...current, ""],
        );
    };

    const handleRemoveSuggestedQuestion = (index: number) => {
        setSuggestedQuestions((current) =>
            current.filter((_, position) => position !== index),
        );
    };

    const handleAddAllowedDomain = () => {
        setAllowedDomainsError("");
        const normalized = normalizeAllowedDomainInput(newAllowedDomain);

        if (!normalized) {
            setAllowedDomainsError(
                "Enter a hostname only, such as support.example.com. Schemes, paths, ports, credentials, and wildcards are not allowed.",
            );
            return;
        }

        if (allowedDomains.includes(normalized)) {
            setAllowedDomainsError("That hostname has already been added.");
            return;
        }

        setAllowedDomains((current) => [...current, normalized]);
        setNewAllowedDomain("");
    };

    const handleAssistantSettingsSave = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIdentityError("");
        setIdentitySuccess("");
        setAllowedDomainsError("");

        const nextBusinessName = businessName.trim();
        const nextAssistantName = assistantName.trim();
        const nextWelcomeMessage = welcomeMessage.trim();
        const nextCustomInstructions = customInstructions.trim();
        const nextSuggestedQuestions = suggestedQuestions
            .map((question) => question.trim())
            .filter((question) => question.length > 0);
        const nextAllowedDomains = allowedDomains.map(normalizeAllowedDomainInput);

        if (nextAllowedDomains.some((domain): domain is null => domain === null)) {
            setAllowedDomainsError("Remove or correct invalid allowed domains before saving.");
            return;
        }

        const normalizedAllowedDomains = [...new Set(nextAllowedDomains)] as string[];

        if (!nextBusinessName || !nextAssistantName || !nextWelcomeMessage) {
            setIdentityError("All assistant identity fields are required.");
            return;
        }

        if (nextSuggestedQuestions.length > MAX_SUGGESTED_QUESTIONS) {
            setIdentityError(
                `You can save up to ${MAX_SUGGESTED_QUESTIONS} suggested questions.`,
            );
            return;
        }

        if (
            nextSuggestedQuestions.some(
                (question) =>
                    question.length > ASSISTANT_SETTINGS_LIMITS.suggestedQuestion,
            )
        ) {
            setIdentityError(
                `Each suggested question must be ${ASSISTANT_SETTINGS_LIMITS.suggestedQuestion} characters or fewer.`,
            );
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
                ...(suggestedQuestionsAvailable
                    ? { suggested_questions: nextSuggestedQuestions }
                    : {}),
                ...(allowedDomainsAvailable
                    ? { allowed_domains: normalizedAllowedDomains }
                    : {}),
            })
            .eq("id", user.id)
            .select(
                suggestedQuestionsAvailable && allowedDomainsAvailable
                    ? "business_name, assistant_name, welcome_message, custom_instructions, suggested_questions, allowed_domains"
                    : suggestedQuestionsAvailable
                        ? "business_name, assistant_name, welcome_message, custom_instructions, suggested_questions"
                        : allowedDomainsAvailable
                            ? "business_name, assistant_name, welcome_message, custom_instructions, allowed_domains"
                            : "business_name, assistant_name, welcome_message, custom_instructions",
            )
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
            setSuggestedQuestions(nextSuggestedQuestions);
            setAllowedDomains(normalizedAllowedDomains);
            setIdentitySuccess("Assistant settings saved.");
        }

        setIdentitySaving(false);
    };

    return (
        <PageFrame>
            <div className="mx-auto w-full max-w-5xl">
                {/* ── Fixed Header ─────────────────── */}
                <PageHeader
                    eyebrow="Workspace configuration"
                    title="Settings"
                    description="Shape how your assistant represents your business, answers customers, and appears in the embedded experience."
                />

                <form onSubmit={handleAssistantSettingsSave} className="mb-8">
                    <div className="border-b border-[var(--border)] pb-4">
                        <h2 className="text-base font-semibold text-[var(--text-primary)]">
                            Assistant identity
                        </h2>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            These details appear in your chat and guide your AI assistant.
                        </p>
                    </div>

                    <fieldset disabled={identityLoading || identitySaving} className="grid gap-x-6 gap-y-5 border-b border-[var(--border)] py-6 sm:grid-cols-2">
                        <div>
                            <label htmlFor="business-name" className="text-xs font-medium text-slate-700 dark:text-slate-300">Business Name</label>
                            <input id="business-name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} maxLength={ASSISTANT_SETTINGS_LIMITS.businessName} required className="mt-1.5 w-full min-h-[44px] sm:min-h-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                        </div>
                        <div>
                            <label htmlFor="assistant-name" className="text-xs font-medium text-slate-700 dark:text-slate-300">Assistant Name</label>
                            <input id="assistant-name" value={assistantName} onChange={(event) => setAssistantName(event.target.value)} maxLength={ASSISTANT_SETTINGS_LIMITS.assistantName} required className="mt-1.5 w-full min-h-[44px] sm:min-h-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                        </div>
                        <div className="sm:col-span-2">
                            <label htmlFor="welcome-message" className="text-xs font-medium text-slate-700 dark:text-slate-300">Welcome Message</label>
                            <textarea id="welcome-message" value={welcomeMessage} onChange={(event) => setWelcomeMessage(event.target.value)} maxLength={ASSISTANT_SETTINGS_LIMITS.welcomeMessage} required rows={2} className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                        </div>
                        <div className="sm:col-span-2">
                            <label htmlFor="custom-instructions" className="text-xs font-medium text-slate-700 dark:text-slate-300">Custom Instructions</label>
                            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Tell the assistant how it should behave when answering customers.</p>
                            <textarea id="custom-instructions" value={customInstructions} onChange={(event) => setCustomInstructions(event.target.value)} maxLength={ASSISTANT_SETTINGS_LIMITS.customInstructions} rows={4} className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                            <p className="mt-1 text-right text-[11px] text-slate-400 dark:text-slate-500">{customInstructions.length}/{ASSISTANT_SETTINGS_LIMITS.customInstructions}</p>
                        </div>
                        <div className="sm:col-span-2 mt-1 border-t border-slate-100 pt-3 dark:border-slate-800">
                            <div className="flex items-baseline justify-between gap-3">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Suggested Questions</h3>
                                {suggestedQuestionsAvailable && (
                                    <span className="text-[11px] text-slate-400 dark:text-slate-500">{suggestedQuestions.length}/{MAX_SUGGESTED_QUESTIONS}</span>
                                )}
                            </div>
                            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                                Show up to {MAX_SUGGESTED_QUESTIONS} questions in your chat before a customer types. Defaults are shown when none are saved.
                            </p>
                            {!suggestedQuestionsAvailable && (
                                <p role="status" className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                                    Not available yet — the database migration that adds the suggested questions column has not been applied.
                                </p>
                            )}
                            {suggestedQuestionsAvailable && (
                                <div className="mt-2 flex flex-col gap-2">
                                    {suggestedQuestions.map((question, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <input
                                                value={question}
                                                onChange={(event) => handleSuggestedQuestionChange(index, event.target.value)}
                                                maxLength={ASSISTANT_SETTINGS_LIMITS.suggestedQuestion}
                                                placeholder="e.g. What is your return policy?"
                                                aria-label={`Suggested question ${index + 1}`}
                                                className="min-w-0 flex-1 min-h-[44px] sm:min-h-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveSuggestedQuestion(index)}
                                                aria-label={`Remove suggested question ${index + 1}`}
                                                className="shrink-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                    <div>
                                        <button
                                            type="button"
                                            onClick={handleAddSuggestedQuestion}
                                            disabled={suggestedQuestions.length >= MAX_SUGGESTED_QUESTIONS}
                                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-teal-200 hover:bg-teal-50/50 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:border-teal-600/50 dark:hover:bg-teal-950/30 dark:hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                                        >
                                            + Add question
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="sm:col-span-2 mt-1 border-t border-slate-100 pt-3 dark:border-slate-800">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                Allowed Domains
                            </h3>
                            <p className="mt-1 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                                Restrict this assistant to exact website hostnames, such as support.example.com.
                                Subdomains are not automatically included. Leave the list empty to disable
                                assistant-specific domain restrictions; global origin restrictions still apply.
                            </p>
                            {!allowedDomainsAvailable ? (
                                <p role="status" className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                                    Not available yet — the database migration that adds allowed domains has not been applied.
                                </p>
                            ) : (
                                <>
                                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                        <input
                                            id="new-allowed-domain"
                                            value={newAllowedDomain}
                                            onChange={(event) => {
                                                setNewAllowedDomain(event.target.value);
                                                setAllowedDomainsError("");
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    event.preventDefault();
                                                    handleAddAllowedDomain();
                                                }
                                            }}
                                            placeholder="support.example.com"
                                            aria-describedby="allowed-domains-help"
                                            className="min-w-0 flex-1 min-h-[44px] sm:min-h-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddAllowedDomain}
                                            className="min-h-[44px] sm:min-h-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-teal-200 hover:bg-teal-50/50 hover:text-teal-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-teal-600/50 dark:hover:bg-teal-950/30 dark:hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                                        >
                                            + Add domain
                                        </button>
                                    </div>
                                    <p id="allowed-domains-help" className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                                        Enter a hostname only — no scheme, path, port, credentials, wildcard, or suffix matching.
                                    </p>
                                    {allowedDomains.length > 0 && (
                                        <ul className="mt-2 flex flex-col gap-2">
                                            {allowedDomains.map((domain) => (
                                                <li key={domain} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                                                    <code className="min-w-0 break-all">{domain}</code>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setAllowedDomains((current) => current.filter((item) => item !== domain));
                                                            setAllowedDomainsError("");
                                                        }}
                                                        aria-label={`Remove ${domain}`}
                                                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/30 dark:hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                                                    >
                                                        Remove
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {allowedDomainsError && (
                                        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
                                            {allowedDomainsError}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="flex min-h-9 items-center sm:col-span-2">
                            {identityLoading && <p className="text-xs text-slate-500 dark:text-slate-400">Loading assistant settings…</p>}
                            {identityError && <p role="alert" aria-live="assertive" className="text-xs text-red-600 dark:text-red-400">{identityError}</p>}
                            {identitySuccess && <p role="status" aria-live="polite" className="text-xs text-emerald-600 dark:text-emerald-400">{identitySuccess}</p>}
                        </div>
                        <div className="flex justify-end sm:col-span-2">
                            <button type="submit" disabled={identityLoading || identitySaving} className="min-h-[44px] sm:min-h-0 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
                                {identitySaving ? "Saving…" : "Save assistant settings"}
                            </button>
                        </div>
                    </fieldset>
                </form>

                <section
                    aria-labelledby="assistant-id-heading"
                    className="mb-8 border-b border-[var(--border)] pb-6"
                >
                    <div className="mb-3">
                        <h2
                            id="assistant-id-heading"
                            className="text-base font-semibold text-[var(--text-primary)]"
                        >
                            Assistant ID
                        </h2>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            Use this ID later to connect your assistant to a website.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                            aria-label="Assistant ID"
                            readOnly
                            value={assistantId ?? ""}
                            placeholder={identityLoading ? "Loading..." : ""}
                            className="min-w-0 flex-1 min-h-[44px] sm:min-h-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                        <button
                            type="button"
                            onClick={handleCopyAssistantId}
                            disabled={!assistantId}
                            className="min-h-[44px] sm:min-h-0 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-900"
                        >
                            Copy
                        </button>
                    </div>
                    {(assistantIdError || assistantIdCopyStatus) && (
                        <p
                            role={assistantIdError ? "alert" : "status"}
                            className={`px-4 pb-4 text-xs ${
                                assistantIdError
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-emerald-600 dark:text-emerald-400"
                            }`}
                        >
                            {assistantIdError || assistantIdCopyStatus}
                        </p>
                    )}
                </section>

                {/* ── Settings grid ─────────────────── */}
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-x-12">
                    {/* LEFT COLUMN */}
                    <div className="flex flex-col gap-10">
                        {/* 1. GENERAL */}
                        <section className="border-b border-[var(--border)] pb-6">
                            <div className="mb-4">
                                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                                    General
                                </h2>
                            </div>

                            <div className="divide-y divide-[var(--border)] text-sm">
                                {/* Theme */}
                                <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2.5">
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
                                <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2.5">
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
                                <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2.5">
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
                        <section className="border-b border-[var(--border)] pb-6">
                            <div className="mb-4">
                                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                                    Notifications
                                </h2>
                            </div>

                            <div className="divide-y divide-[var(--border)] text-sm">
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
                    <div className="flex flex-col gap-10">
                        {/* 3. AI PREFERENCES */}
                        <section className="border-b border-[var(--border)] pb-6">
                            <div className="mb-4">
                                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                                    AI Preferences
                                </h2>
                            </div>

                            <div className="divide-y divide-[var(--border)] text-sm">
                                <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2.5">
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
                        <section className="border-b border-[var(--border)] pb-6">
                            <div className="mb-4">
                                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                                    Account
                                </h2>
                            </div>

                            <div className="divide-y divide-[var(--border)] text-sm">
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
                <div className="mt-8 border-t border-[var(--border)] pt-4 text-center text-xs text-[var(--text-secondary)]">
                    Assistant identity is securely synced to your account. Other settings are stored locally in your browser.
                </div>
            </div>
        </PageFrame>
    );
}
