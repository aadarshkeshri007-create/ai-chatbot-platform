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
    DEFAULT_RESPONSE_LENGTH,
    DEFAULT_WELCOME_MESSAGE,
    MAX_SUGGESTED_QUESTIONS,
    getAssistantSettings,
    parseSuggestedQuestions,
} from "@/lib/assistant-settings";
import type { ResponseLength } from "@/lib/assistant-settings";
import {
    DEFAULT_HANDOFF_INTRO,
    DEFAULT_RESPONSE_LANGUAGE,
    DEFAULT_RESPONSE_TONE,
    DEFAULT_UNKNOWN_ANSWER_BEHAVIOR,
    DEFAULT_UNKNOWN_ANSWER_MESSAGE,
} from "@/lib/assistant-behavior";
import type { ResponseLanguage, ResponseTone, UnknownAnswerBehavior } from "@/lib/assistant-behavior";
import { normalizeAllowedDomainInput } from "@/lib/public-chat-origin";
import { DEFAULT_BRAND_COLOR, getBrandTextColor, normalizeBrandColor } from "@/lib/brand-color";
import PageFrame from "@/components/PageFrame";
import PageHeader from "@/components/PageHeader";

/* ── Types ─────────────────────────────────────── */

function RadioGroup<T extends string>({
    name,
    options,
    value,
    onChange,
    disabled = false,
}: {
    name: string;
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {options.map((option) => (
                <label
                    key={option.value}
                    className={`relative inline-flex min-h-11 items-center cursor-pointer rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-150 focus-within:ring-2 focus-within:ring-[var(--focus)] focus-within:ring-offset-2 ${disabled ? "cursor-not-allowed opacity-60" : ""} ${
                        value === option.value
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-link)] shadow-sm"
                            : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:bg-[var(--background)]"
                    }`}
                >
                    <input
                        type="radio"
                        name={name}
                        value={option.value}
                        checked={value === option.value}
                        disabled={disabled}
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

    const [responseLength, setResponseLength] = useState<ResponseLength>(DEFAULT_RESPONSE_LENGTH);
    const [responsePreferencesAvailable, setResponsePreferencesAvailable] = useState(true);
    const [responseTone, setResponseTone] = useState<ResponseTone>(DEFAULT_RESPONSE_TONE);
    const [responseLanguage, setResponseLanguage] = useState<ResponseLanguage>(DEFAULT_RESPONSE_LANGUAGE);
    const [unknownAnswerBehavior, setUnknownAnswerBehavior] = useState<UnknownAnswerBehavior>(DEFAULT_UNKNOWN_ANSWER_BEHAVIOR);
    const [unknownAnswerMessage, setUnknownAnswerMessage] = useState(DEFAULT_UNKNOWN_ANSWER_MESSAGE);
    const [handoffEnabled, setHandoffEnabled] = useState(true);
    const [handoffIntro, setHandoffIntro] = useState(DEFAULT_HANDOFF_INTRO);
    const [behaviorSettingsAvailable, setBehaviorSettingsAvailable] = useState(true);
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
    const [brandColor, setBrandColor] = useState(DEFAULT_BRAND_COLOR);
    const [brandColorAvailable, setBrandColorAvailable] = useState(true);
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

            const { data: appearance, error: appearanceError } = await supabase
                .from("profiles")
                .select("brand_color")
                .eq("id", user.id)
                .maybeSingle();
            if (isMissingSchemaFieldError(appearanceError)) {
                setBrandColorAvailable(false);
            } else if (appearanceError) {
                logSupabaseError("Assistant brand color load error:", appearanceError);
            } else {
                setBrandColor(normalizeBrandColor(appearance?.brand_color) ?? DEFAULT_BRAND_COLOR);
            }

            const { data: responsePreferences, error: preferencesError } = await supabase
                .from("profiles")
                .select("response_style, response_length")
                .eq("id", user.id)
                .maybeSingle();
            if (isMissingSchemaFieldError(preferencesError)) {
                setResponsePreferencesAvailable(false);
            } else if (preferencesError) {
                logSupabaseError("Assistant response preferences load error:", preferencesError);
            } else {
                const preferences = getAssistantSettings(responsePreferences);
                setResponseLength(preferences.responseLength);
            }

            const { data: behaviorSettings, error: behaviorError } = await supabase
                .from("profiles")
                .select("response_tone, response_language, unknown_answer_behavior, unknown_answer_message, handoff_enabled, handoff_intro")
                .eq("id", user.id)
                .maybeSingle();
            if (isMissingSchemaFieldError(behaviorError)) {
                setBehaviorSettingsAvailable(false);
            } else if (behaviorError) {
                logSupabaseError("Assistant behavior settings load error:", behaviorError);
                setIdentityError("Unable to load assistant behavior settings.");
            } else {
                const behavior = getAssistantSettings(behaviorSettings);
                setResponseTone(behavior.responseTone);
                setResponseLanguage(behavior.responseLanguage);
                setUnknownAnswerBehavior(behavior.unknownAnswerBehavior);
                setUnknownAnswerMessage(behavior.unknownAnswerMessage);
                setHandoffEnabled(behavior.handoffEnabled);
                setHandoffIntro(behavior.handoffIntro);
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
        const nextBrandColor = normalizeBrandColor(brandColor);
        if (!nextBrandColor) {
            setIdentityError("Choose a valid brand color.");
            return;
        }

        if (!nextBusinessName || !nextAssistantName || !nextWelcomeMessage) {
            setIdentityError("All assistant identity fields are required.");
            return;
        }

        if (unknownAnswerBehavior === "custom_message" && !unknownAnswerMessage.trim()) {
            setIdentityError("Add the message the assistant should use when it cannot answer.");
            return;
        }
        if (handoffEnabled && !handoffIntro.trim()) {
            setIdentityError("Add a short introduction for support requests.");
            return;
        }
        if (unknownAnswerMessage.trim().length > 500 || handoffIntro.trim().length > 500) {
            setIdentityError("Fallback and handoff messages must be 500 characters or fewer.");
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
                ...(brandColorAvailable ? { brand_color: nextBrandColor } : {}),
                ...(responsePreferencesAvailable ? {
                    response_style: responseTone === "friendly" || responseTone === "empathetic"
                        ? "friendly"
                        : responseTone === "concise" ? "balanced" : "formal",
                    response_length: responseLength,
                } : {}),
                ...(behaviorSettingsAvailable ? {
                    response_tone: responseTone,
                    response_language: responseLanguage,
                    unknown_answer_behavior: unknownAnswerBehavior,
                    unknown_answer_message: unknownAnswerMessage.trim(),
                    handoff_enabled: handoffEnabled,
                    handoff_intro: handoffIntro.trim(),
                } : {}),
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
            setBrandColor(nextBrandColor);
            setIdentitySuccess(
                !brandColorAvailable || !responsePreferencesAvailable || !behaviorSettingsAvailable
                    ? "Available assistant settings saved. Apply the assistant behavior migration to save the new behavior controls."
                    : "Assistant settings saved.",
            );
        }

        setIdentitySaving(false);
    };

    return (
        <PageFrame>
            <div className="mx-auto w-full max-w-4xl">
                {/* ── Fixed Header ─────────────────── */}
                <PageHeader
                    eyebrow="Workspace configuration"
                    title="Settings"
                    description="Shape how your assistant represents your business, answers customers, and appears in the embedded experience."
                />

                <nav aria-label="Settings sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-[var(--border)] pb-2 text-sm scrollbar-thin">
                    {[["settings-assistant", "Assistant"], ["settings-domains", "Domains"], ["settings-general", "General"], ["settings-ai", "AI preferences"], ["settings-account", "Account"]].map(([id, label]) => (
                        <a key={id} href={`#${id}`} className="shrink-0 rounded-md px-3 py-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">{label}</a>
                    ))}
                </nav>

                <form id="settings-assistant" onSubmit={handleAssistantSettingsSave} className="mb-6 scroll-mt-4">
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
                            <label htmlFor="business-name" className="text-xs font-medium text-[var(--text-primary)] dark:text-[var(--text-secondary)]">Business Name</label>
                            <input id="business-name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} maxLength={ASSISTANT_SETTINGS_LIMITS.businessName} required className="mt-1.5 w-full min-h-[44px] sm:min-h-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base sm:text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--text-primary)]" />
                        </div>
                        <div>
                            <label htmlFor="assistant-name" className="text-xs font-medium text-[var(--text-primary)] dark:text-[var(--text-secondary)]">Assistant Name</label>
                            <input id="assistant-name" value={assistantName} onChange={(event) => setAssistantName(event.target.value)} maxLength={ASSISTANT_SETTINGS_LIMITS.assistantName} required className="mt-1.5 w-full min-h-[44px] sm:min-h-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base sm:text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--text-primary)]" />
                        </div>
                        <div className="sm:col-span-2">
                            <label htmlFor="welcome-message" className="text-xs font-medium text-[var(--text-primary)] dark:text-[var(--text-secondary)]">Welcome Message</label>
                            <textarea id="welcome-message" value={welcomeMessage} onChange={(event) => setWelcomeMessage(event.target.value)} maxLength={ASSISTANT_SETTINGS_LIMITS.welcomeMessage} required rows={2} className="mt-1.5 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base sm:text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--text-primary)]" />
                        </div>
                        <div className="sm:col-span-2">
                            <label htmlFor="custom-instructions" className="text-xs font-medium text-[var(--text-primary)] dark:text-[var(--text-secondary)]">Custom Instructions</label>
                            <p className="mt-1 text-[11px] text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">Business guidance may shape answers, but grounding and safety rules always take precedence.</p>
                            <textarea id="custom-instructions" value={customInstructions} onChange={(event) => setCustomInstructions(event.target.value)} maxLength={ASSISTANT_SETTINGS_LIMITS.customInstructions} rows={4} className="mt-1.5 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base sm:text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--text-primary)]" />
                            <p className="mt-1 text-right text-[11px] text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">{customInstructions.length}/{ASSISTANT_SETTINGS_LIMITS.customInstructions}</p>
                        </div>
                        <div className="sm:col-span-2 mt-1 border-t border-[var(--border)] pt-3 dark:border-[var(--border)]">
                            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                <div>
                                    <label htmlFor="assistant-brand-color" className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] dark:text-[var(--text-primary)]">Widget brand color</label>
                                    <p className="mt-1 text-[11px] text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">One color sets the launcher, widget header, customer bubbles, and primary actions.</p>
                                    {!brandColorAvailable && <p role="status" className="mt-1 text-xs text-[var(--warning)] dark:text-[var(--warning)]">Apply the brand color migration to save this setting. The default color remains active until then.</p>}
                                </div>
                                <div className="flex items-center gap-3">
                                    <input id="assistant-brand-color" type="color" value={brandColor} onChange={(event) => setBrandColor(event.target.value)} disabled={!brandColorAvailable} aria-label="Widget brand color" className="h-11 w-14 cursor-pointer rounded-md border border-[var(--border)] bg-[var(--surface)] p-1 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[var(--border)] dark:bg-[var(--surface-muted)]" />
                                    <code className="text-sm font-medium text-[var(--text-primary)] dark:text-[var(--text-primary)]">{brandColor}</code>
                                </div>
                            </div>
                            <div className="mt-4 flex max-w-md overflow-hidden rounded-xl border border-[var(--border)] shadow-sm dark:border-[var(--border)]" aria-label="Widget brand preview">
                                <div className="flex-1 bg-[var(--surface)] p-3 dark:bg-[var(--surface)]">
                                    <div className="-mx-3 -mt-3 mb-3 px-3 py-2 text-sm font-semibold" style={{ backgroundColor: brandColor, color: getBrandTextColor(brandColor) }}>Your Assistant</div>
                                    <div className="mb-2 w-fit rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-primary)] dark:bg-[var(--surface-muted)] dark:text-[var(--text-primary)]">How can I help?</div>
                                    <div className="ml-auto w-fit rounded-xl px-3 py-2 text-xs" style={{ backgroundColor: brandColor, color: getBrandTextColor(brandColor) }}>Track my order</div>
                                    <div className="mt-2 flex justify-end"><span className="rounded-full px-3 py-1.5 text-xs font-semibold shadow" style={{ backgroundColor: brandColor, color: getBrandTextColor(brandColor) }}>●</span></div>
                                </div>
                            </div>
                        </div>
                        <div className="sm:col-span-2 mt-1 border-t border-[var(--border)] pt-3 dark:border-[var(--border)]">
                            <div className="flex items-baseline justify-between gap-3">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">Suggested Questions</h3>
                                {suggestedQuestionsAvailable && (
                                    <span className="text-[11px] text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">{suggestedQuestions.length}/{MAX_SUGGESTED_QUESTIONS}</span>
                                )}
                            </div>
                            <p className="mt-1 text-[11px] text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
                                Show up to {MAX_SUGGESTED_QUESTIONS} questions in your chat before a customer types. Defaults are shown when none are saved.
                            </p>
                            {!suggestedQuestionsAvailable && (
                                <p role="status" className="mt-2 text-[11px] text-[var(--warning)] dark:text-[var(--warning)]">
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
                                                className="min-w-0 flex-1 min-h-[44px] sm:min-h-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base sm:text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--text-primary)]"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveSuggestedQuestion(index)}
                                                aria-label={`Remove suggested question ${index + 1}`}
                                                className="shrink-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded-[var(--radius-control)] border border-[var(--border)] px-2.5 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[color-mix(in_srgb,var(--error)_25%,var(--border))] hover:bg-[var(--error-soft)] hover:text-[var(--error)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[var(--border)] dark:text-[var(--text-secondary)] dark:hover:border-[color-mix(in_srgb,var(--error)_40%,var(--border))] dark:hover:bg-[var(--error-soft)] dark:hover:text-[var(--error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--error)] focus-visible:ring-offset-2"
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
                                            className="rounded-[var(--radius-control)] border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-link)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[var(--border)] dark:text-[var(--text-secondary)] dark:hover:border-[var(--accent)] dark:hover:bg-[var(--accent-soft)] dark:hover:text-[var(--accent-link)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
                                        >
                                            + Add question
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="sm:col-span-2 mt-1 border-t border-[var(--border)] pt-3 dark:border-[var(--border)]">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
                                Allowed Domains
                            </h3>
                            <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
                                Restrict this assistant to exact website hostnames, such as support.example.com.
                                Subdomains are not automatically included. Leave the list empty to disable
                                assistant-specific domain restrictions; global origin restrictions still apply.
                            </p>
                            {!allowedDomainsAvailable ? (
                                <p role="status" className="mt-2 text-[11px] text-[var(--warning)] dark:text-[var(--warning)]">
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
                                            className="min-w-0 flex-1 min-h-[44px] sm:min-h-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base sm:text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20 dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--text-primary)]"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddAllowedDomain}
                                            className="min-h-[44px] sm:min-h-0 rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-link)] dark:border-[var(--border)] dark:text-[var(--text-secondary)] dark:hover:border-[var(--accent)] dark:hover:bg-[var(--accent-soft)] dark:hover:text-[var(--accent-link)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
                                        >
                                            + Add domain
                                        </button>
                                    </div>
                                    <p id="allowed-domains-help" className="mt-1 text-[11px] text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
                                        Enter a hostname only — no scheme, path, port, credentials, wildcard, or suffix matching.
                                    </p>
                                    {allowedDomains.length > 0 && (
                                        <ul className="mt-2 flex flex-col gap-2">
                                            {allowedDomains.map((domain) => (
                                                <li key={domain} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] dark:border-[var(--border)] dark:bg-[var(--surface-muted)]/70 dark:text-[var(--text-primary)]">
                                                    <code className="min-w-0 break-all">{domain}</code>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setAllowedDomains((current) => current.filter((item) => item !== domain));
                                                            setAllowedDomainsError("");
                                                        }}
                                                        aria-label={`Remove ${domain}`}
                                                        className="shrink-0 rounded-[var(--radius-control)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--error-soft)] hover:text-[var(--error)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--error-soft)] dark:hover:text-[var(--error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--error)] focus-visible:ring-offset-2"
                                                    >
                                                        Remove
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {allowedDomainsError && (
                                        <p role="alert" className="mt-2 text-xs text-[var(--error)] dark:text-[var(--error)]">
                                            {allowedDomainsError}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="flex min-h-9 items-center sm:col-span-2">
                            {identityLoading && <p className="text-xs text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">Loading assistant settings…</p>}
                            {identityError && <p role="alert" aria-live="assertive" className="text-xs text-[var(--error)] dark:text-[var(--error)]">{identityError}</p>}
                            {identitySuccess && <p role="status" aria-live="polite" className="text-xs text-[var(--success)] dark:text-[var(--success)]">{identitySuccess}</p>}
                        </div>
                        <div className="flex justify-end sm:col-span-2">
                            <button type="submit" disabled={identityLoading || identitySaving} className="min-h-[44px] sm:min-h-0 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[var(--accent)] dark:hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2">
                                {identitySaving ? "Saving…" : "Save assistant settings"}
                            </button>
                        </div>
                    </fieldset>
                </form>

                <section
                    id="settings-domains"
                    aria-labelledby="assistant-id-heading"
                    className="mb-6 scroll-mt-4 border-b border-[var(--border)] pb-6"
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
                            className="min-w-0 flex-1 min-h-[44px] sm:min-h-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] outline-none dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--text-primary)]"
                        />
                        <button
                            type="button"
                            onClick={handleCopyAssistantId}
                            disabled={!assistantId}
                            className="min-h-[44px] sm:min-h-0 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-[var(--background)]"
                        >
                            Copy
                        </button>
                    </div>
                    {(assistantIdError || assistantIdCopyStatus) && (
                        <p
                            role={assistantIdError ? "alert" : "status"}
                            className={`px-4 pb-4 text-xs ${
                                assistantIdError
                                    ? "text-[var(--warning)] dark:text-[var(--warning)]"
                                    : "text-[var(--success)] dark:text-[var(--success)]"
                            }`}
                        >
                            {assistantIdError || assistantIdCopyStatus}
                        </p>
                    )}
                </section>

                {/* ── Settings grid ─────────────────── */}
                <div className="grid grid-cols-1 gap-6">
                    {/* LEFT COLUMN */}
                    <div className="flex flex-col gap-6">
                        {/* 1. GENERAL */}
                        <section id="settings-general" className="scroll-mt-4 border-b border-[var(--border)] pb-6">
                            <div className="mb-4">
                                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                                    General
                                </h2>
                            </div>

                            <div className="divide-y divide-[var(--border)] text-sm">
                                {/* Theme */}
                                <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2.5">
                                    <div>
                                        <label className="font-medium text-[var(--text-primary)] dark:text-[var(--text-secondary)]">
                                            Theme
                                        </label>
                                        <p className="text-[11px] text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
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

                            </div>
                        </section>

                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="flex flex-col gap-6">
                        {/* 3. AI PREFERENCES */}
                        <section id="settings-ai" className="scroll-mt-4 border-b border-[var(--border)] pb-6">
                            <div className="mb-4">
                                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                                    AI Preferences
                                </h2>
                            </div>

                            <div className="divide-y divide-[var(--border)] text-sm">
                                {!behaviorSettingsAvailable && <p role="status" className="px-4 py-3 text-xs text-[var(--warning)]">Apply the assistant behavior migration before these assistant-wide settings can be saved.</p>}
                                <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2.5">
                                    <div>
                                        <label className="font-medium text-[var(--text-primary)]">Response tone</label>
                                        <p className="text-[11px] text-[var(--text-secondary)]">Choose how answers sound. Grounding and safety rules always take precedence.</p>
                                    </div>
                                    <RadioGroup<ResponseTone>
                                        name="response-tone"
                                        value={responseTone}
                                        onChange={setResponseTone}
                                        disabled={identityLoading || identitySaving || !behaviorSettingsAvailable}
                                        options={[
                                            { value: "professional", label: "Professional" },
                                            { value: "friendly", label: "Friendly" },
                                            { value: "concise", label: "Concise" },
                                            { value: "empathetic", label: "Empathetic" },
                                        ]}
                                    />
                                </div>
                                <div className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] sm:items-start">
                                    <div>
                                        <label htmlFor="response-language" className="font-medium text-[var(--text-primary)]">Default response language</label>
                                        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Automatic follows the customer’s language. A chosen language changes wording only, not knowledge retrieval.</p>
                                    </div>
                                    <select id="response-language" value={responseLanguage} onChange={(event) => setResponseLanguage(event.target.value as ResponseLanguage)} disabled={identityLoading || identitySaving || !behaviorSettingsAvailable} className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] disabled:opacity-60">
                                        <option value="auto">Automatic (match customer)</option><option value="en">English</option><option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option><option value="pt">Portuguese</option><option value="hi">Hindi</option><option value="ja">Japanese</option><option value="zh">Chinese</option><option value="ar">Arabic</option>
                                    </select>
                                </div>
                                <div className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] sm:items-start">
                                    <div>
                                        <label htmlFor="unknown-answer-behavior" className="font-medium text-[var(--text-primary)]">When the answer isn’t in your knowledge</label>
                                        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">The assistant will never fill gaps with unsupported business claims.</p>
                                    </div>
                                    <select id="unknown-answer-behavior" value={unknownAnswerBehavior} onChange={(event) => setUnknownAnswerBehavior(event.target.value as UnknownAnswerBehavior)} disabled={identityLoading || identitySaving || !behaviorSettingsAvailable} className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] disabled:opacity-60">
                                        <option value="contact_support">Admit uncertainty and suggest support</option><option value="offer_handoff" disabled={!handoffEnabled}>Offer a support request</option><option value="custom_message">Use my fallback message</option>
                                    </select>
                                    {unknownAnswerBehavior === "custom_message" && <textarea aria-label="Unknown answer fallback message" value={unknownAnswerMessage} onChange={(event) => setUnknownAnswerMessage(event.target.value)} maxLength={500} rows={3} disabled={identityLoading || identitySaving || !behaviorSettingsAvailable} className="min-h-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] sm:col-start-2" />}
                                </div>
                                <div className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] sm:items-start">
                                    <div>
                                        <label htmlFor="handoff-enabled" className="font-medium text-[var(--text-primary)]">Human support requests</label>
                                        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Visitors can submit a request to your team. This does not indicate that an agent is currently online.</p>
                                    </div>
                                    <div className="sm:col-start-2">
                                        <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--text-primary)]"><input id="handoff-enabled" type="checkbox" checked={handoffEnabled} onChange={(event) => { const enabled = event.target.checked; setHandoffEnabled(enabled); if (!enabled && unknownAnswerBehavior === "offer_handoff") setUnknownAnswerBehavior("contact_support"); }} disabled={identityLoading || identitySaving || !behaviorSettingsAvailable} className="h-4 w-4 accent-[var(--accent)]" />Allow support requests</label>
                                        {handoffEnabled && <textarea aria-label="Human handoff introduction" value={handoffIntro} onChange={(event) => setHandoffIntro(event.target.value)} maxLength={500} rows={2} disabled={identityLoading || identitySaving || !behaviorSettingsAvailable} className="mt-2 min-h-20 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]" />}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2.5">
                                    <div>
                                        <label className="font-medium text-[var(--text-primary)] dark:text-[var(--text-secondary)]">
                                            Response length
                                        </label>
                                        <p className="text-[11px] text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
                                            Controls answer detail; knowledge grounding stays enabled.
                                        </p>
                                        {!responsePreferencesAvailable && <p role="status" className="mt-1 text-xs text-[var(--warning)] dark:text-[var(--warning)]">Apply the widget settings migration to save response preferences.</p>}
                                    </div>
                                    <RadioGroup<ResponseLength>
                                        name="response-length"
                                        value={responseLength}
                                        onChange={setResponseLength}
                                        disabled={identityLoading || identitySaving || !responsePreferencesAvailable}
                                        options={[
                                            { value: "short", label: "Short" },
                                            { value: "balanced", label: "Balanced" },
                                            { value: "detailed", label: "Detailed" },
                                        ]}
                                    />
                                </div>

                                <div className="px-4 py-3 text-sm">
                                    <p className="font-medium text-[var(--text-primary)] dark:text-[var(--text-secondary)]">Knowledge grounding</p>
                                    <p className="mt-1 text-[11px] text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">Always enabled. Unsupported business-specific answers are declined.</p>
                                </div>
                            </div>
                        </section>

                        {/* 4. ACCOUNT */}
                        <section id="settings-account" className="scroll-mt-4 border-b border-[var(--border)] pb-6">
                            <div className="mb-4">
                                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                                    Account
                                </h2>
                            </div>

                            <div className="divide-y divide-[var(--border)] text-sm">
                                <Link
                                    href="/profile"
                                    className="flex items-center justify-between px-4 py-2.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--background)] hover:text-[var(--text-primary)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--surface-muted)] dark:hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus)]"
                                >
                                    <span className="flex items-center gap-2 font-medium">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                        Profile Details
                                    </span>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-[var(--text-muted)] dark:text-[var(--text-secondary)]">
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </Link>

                            </div>
                        </section>
                    </div>
                </div>

                {/* ── Notice Footer ────────────── */}
                <div className="mt-8 border-t border-[var(--border)] pt-4 text-center text-xs text-[var(--text-secondary)]">
                    Assistant identity and behavior settings sync to your account. Theme preference is stored in this browser.
                </div>
            </div>
        </PageFrame>
    );
}
