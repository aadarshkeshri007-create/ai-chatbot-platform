import { getAssistantBehavior } from "./assistant-behavior.ts";

export const DEFAULT_BUSINESS_NAME = "Your Business";
export const DEFAULT_ASSISTANT_NAME = "AI Support";
export const DEFAULT_WELCOME_MESSAGE = "Hello! How can I assist you today?";
export type ResponseStyle = "formal" | "balanced" | "friendly";
export type ResponseLength = "short" | "balanced" | "detailed";
export const DEFAULT_RESPONSE_STYLE: ResponseStyle = "balanced";
export const DEFAULT_RESPONSE_LENGTH: ResponseLength = "balanced";

// Shown in the chat empty state until the business configures its own questions.
export const DEFAULT_SUGGESTED_QUESTIONS = [
  "How do I reset my password?",
  "What are your business hours?",
  "I need help with my recent order",
] as const;

export const MAX_SUGGESTED_QUESTIONS = 5;

export const ASSISTANT_SETTINGS_LIMITS = {
  businessName: 100,
  assistantName: 100,
  welcomeMessage: 500,
  customInstructions: 4000,
  suggestedQuestion: 200,
} as const;

type AssistantSettingsRow = {
  business_name?: string | null;
  assistant_name?: string | null;
  welcome_message?: string | null;
  custom_instructions?: string | null;
  suggested_questions?: unknown;
  response_style?: unknown;
  response_length?: unknown;
  response_tone?: unknown;
  response_language?: unknown;
  unknown_answer_behavior?: unknown;
  unknown_answer_message?: unknown;
  handoff_enabled?: unknown;
  handoff_intro?: unknown;
};

const valueOrFallback = (value: string | null | undefined, fallback: string) =>
  value?.trim() || fallback;

/* Normalizes the stored text[] for editing: trimmed, non-empty, at most 5
 * entries of 200 characters, with no fallback applied. */
export function parseSuggestedQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((question): question is string => typeof question === "string")
    .map((question) => question.trim())
    .filter((question) => question.length > 0)
    .map((question) =>
      question.slice(0, ASSISTANT_SETTINGS_LIMITS.suggestedQuestion),
    )
    .slice(0, MAX_SUGGESTED_QUESTIONS);
}

/* Same normalization, but falls back to the default questions when the business
 * has not configured any. */
export function resolveSuggestedQuestions(value: unknown): string[] {
  const questions = parseSuggestedQuestions(value);
  return questions.length > 0 ? questions : [...DEFAULT_SUGGESTED_QUESTIONS];
}

export function getAssistantSettings(settings?: AssistantSettingsRow | null) {
  const behavior = getAssistantBehavior(settings);
  return {
    businessName: valueOrFallback(settings?.business_name, DEFAULT_BUSINESS_NAME),
    assistantName: valueOrFallback(settings?.assistant_name, DEFAULT_ASSISTANT_NAME),
    welcomeMessage: valueOrFallback(
      settings?.welcome_message,
      DEFAULT_WELCOME_MESSAGE,
    ),
    customInstructions: settings?.custom_instructions?.trim() || "",
    suggestedQuestions: resolveSuggestedQuestions(settings?.suggested_questions),
    responseStyle: settings?.response_style === "formal" || settings?.response_style === "friendly"
      ? settings.response_style
      : DEFAULT_RESPONSE_STYLE,
    responseLength: settings?.response_length === "short" || settings?.response_length === "detailed"
      ? settings.response_length
      : DEFAULT_RESPONSE_LENGTH,
    ...behavior,
  };
}
