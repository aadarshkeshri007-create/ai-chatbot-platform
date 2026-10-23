export const RESPONSE_TONES = ["professional", "friendly", "concise", "empathetic"] as const;
export type ResponseTone = (typeof RESPONSE_TONES)[number];

export const RESPONSE_LANGUAGES = ["auto", "en", "es", "fr", "de", "pt", "hi", "ja", "zh", "ar"] as const;
export type ResponseLanguage = (typeof RESPONSE_LANGUAGES)[number];

export const UNKNOWN_ANSWER_BEHAVIORS = ["contact_support", "offer_handoff", "custom_message"] as const;
export type UnknownAnswerBehavior = (typeof UNKNOWN_ANSWER_BEHAVIORS)[number];

export const DEFAULT_RESPONSE_TONE: ResponseTone = "professional";
export const DEFAULT_RESPONSE_LANGUAGE: ResponseLanguage = "auto";
export const DEFAULT_UNKNOWN_ANSWER_BEHAVIOR: UnknownAnswerBehavior = "contact_support";
export const DEFAULT_UNKNOWN_ANSWER_MESSAGE =
  "I’m sorry, but the knowledge base doesn’t contain enough information to answer that. Please contact the support team for help.";
export const DEFAULT_HANDOFF_INTRO =
  "You can send a request to the support team. A reply may not be immediate.";

type BehaviorRow = {
  response_tone?: unknown;
  response_language?: unknown;
  unknown_answer_behavior?: unknown;
  unknown_answer_message?: unknown;
  handoff_enabled?: unknown;
  handoff_intro?: unknown;
};

const validEnum = <T extends readonly string[]>(value: unknown, options: T, fallback: T[number]): T[number] =>
  typeof value === "string" && options.includes(value) ? value : fallback;

const cleanMessage = (value: unknown, fallback: string, limit: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : fallback;

export function getAssistantBehavior(row?: BehaviorRow | null) {
  return {
    responseTone: validEnum(row?.response_tone, RESPONSE_TONES, DEFAULT_RESPONSE_TONE),
    responseLanguage: validEnum(row?.response_language, RESPONSE_LANGUAGES, DEFAULT_RESPONSE_LANGUAGE),
    unknownAnswerBehavior: validEnum(row?.unknown_answer_behavior, UNKNOWN_ANSWER_BEHAVIORS, DEFAULT_UNKNOWN_ANSWER_BEHAVIOR),
    unknownAnswerMessage: cleanMessage(row?.unknown_answer_message, DEFAULT_UNKNOWN_ANSWER_MESSAGE, 500),
    handoffEnabled: row?.handoff_enabled !== false,
    handoffIntro: cleanMessage(row?.handoff_intro, DEFAULT_HANDOFF_INTRO, 500),
  };
}

export function languageInstruction(language: ResponseLanguage): string {
  if (language === "auto") return "Reply in the same language as the customer's latest message. Do not let language choice change retrieval, grounding, or factual claims.";
  const names: Record<Exclude<ResponseLanguage, "auto">, string> = {
    en: "English", es: "Spanish", fr: "French", de: "German", pt: "Portuguese",
    hi: "Hindi", ja: "Japanese", zh: "Chinese", ar: "Arabic",
  };
  return `Answer in ${names[language]}. Understand the customer's original question and use retrieved knowledge regardless of its language; translate only supported information. Do not let language choice change grounding or factual claims.`;
}

export function unknownAnswerMessage(
  behavior: UnknownAnswerBehavior,
  customMessage: string,
  handoffEnabled: boolean,
): string {
  if (behavior === "custom_message") return customMessage;
  if (behavior === "offer_handoff" && handoffEnabled) {
    return "I’m sorry, but the knowledge base doesn’t contain enough information to answer that. You can send a request to the support team for help.";
  }
  return DEFAULT_UNKNOWN_ANSWER_MESSAGE;
}

export function responseToneInstruction(tone: ResponseTone): string {
  const guidance: Record<ResponseTone, string> = {
    professional: "Use clear, courteous, business-appropriate wording.",
    friendly: "Use warm, approachable wording while staying professional.",
    concise: "Use the fewest words that fully answer the question; keep necessary qualifications and citations.",
    empathetic: "Acknowledge the customer's concern briefly, then give a calm, helpful answer without making unsupported promises.",
  };
  return guidance[tone];
}
