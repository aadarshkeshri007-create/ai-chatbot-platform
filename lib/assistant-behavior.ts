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

export type EscalationReason =
  | "explicit_request"
  | "insufficient_evidence"
  | "repeated_failures";

export const REPEATED_ABSTENTION_THRESHOLD = 2;

const EXPLICIT_HANDOFF_FALSE_POSITIVE_PATTERN =
  /\b(?:human\s+(?:resources|rights|error|errors|being|beings|nature|anatomy|biology|factors|capital|centered|interface)|(?:user|travel|real\s+estate|insurance|secret|software|ai|virtual|automated|booking|cleaning|chemical|oxidizing)\s+agents?|(?:browser|language|device|platform|os|file|format)\s+support|does\s+(?:this|it|your\s+\w+)\s+support)\b/i;

const EXPLICIT_HANDOFF_DIRECT_PHRASE_PATTERN =
  /^(?:please\s+)?(?:human|live\s+agent|real\s+person|live\s+person|support\s+agent|human\s+agent|human\s+support|customer\s+service\s+representative|representative|operator)(?:\s+please)?$/i;

const EXPLICIT_HANDOFF_ACTION_PATTERN =
  /\b(?:talk|speak|chat|connect(?:\s+me)?|transfer(?:\s+me)?|escalate(?:\s+this|\s+me)?|switch(?:\s+me)?|hand(?:\s+me)?\s+off|put\s+me\s+through|get\s+me(?:\s+in\s+touch)?)\s+(?:to|with)\s+(?:a\s+|an\s+|the\s+|your\s+|some\s+)?(?:human(?:\s+being|\s+agent|\s+person|\s+support)?|real\s+person|live\s+person|actual\s+person|person|someone(?:\s+real|\s+from\s+(?:your|the)\s+(?:support\s+)?team)?|agent|live\s+agent|support\s+agent|customer\s+service(?:\s+agent|\s+rep|\s+representative)?|representative|rep|operator|support\s+team|support|team|staff|specialist)\b/i;

const EXPLICIT_HANDOFF_DESIRE_PATTERN =
  /\b(?:i\s+(?:want|need|would\s+like|prefer)(?:\s+to\s+(?:talk|speak|chat|connect|reach(?:\s+out)?)\s+(?:to|with))?|can\s+i\s+(?:get|have|talk\s+to|speak\s+to|speak\s+with|chat\s+with|reach|contact)|could\s+i\s+(?:get|have|talk\s+to|speak\s+to|speak\s+with|chat\s+with|reach|contact)|let\s+me\s+(?:talk|speak|chat)\s+(?:to|with)|please\s+(?:connect|transfer|put)\s+me\s+(?:to|with|through\s+to))\s+(?:a\s+|an\s+|the\s+|your\s+)?(?:human(?:\s+being|\s+agent|\s+person|\s+support)?|real\s+person|live\s+person|actual\s+person|live\s+agent|support\s+agent|customer\s+service(?:\s+agent|\s+rep|\s+representative)?|representative|support\s+team|agent)\b/i;

const EXPLICIT_HANDOFF_CONTACT_SUPPORT_PATTERN =
  /^(?:(?:please|i\s+want\s+to|i\s+need\s+to|i'd\s+like\s+to|i\s+would\s+like\s+to|can\s+i|could\s+i|how\s+(?:do|can)\s+i)\s+)?(?:contact|reach(?:\s+out\s+to)?|message|get\s+help\s+from)\s+(?:a\s+human\s+at\s+|human\s+)?(?:support|customer\s+support|the\s+support\s+team|your\s+support\s+team|your\s+team)(?:\s+please|\s+now|\s+directly)?$/i;

const EXPLICIT_HANDOFF_TEAM_HELP_PATTERN =
  /\b(?:(?:can|could|may|will)\s+(?:someone|somebody|a\s+person|a\s+human|an\s+agent|a\s+team\s+member)\s+(?:from\s+(?:your|the)\s+(?:support\s+)?team\s+|on\s+(?:your|the)\s+(?:support\s+)?team\s+)?(?:help|assist|contact|reach\s+out\s+to)\s+me|(?:need|want|get)\s+(?:human|live\s+agent|real\s+person)\s+(?:help|support|assistance))\b/i;

export function isExplicitHumanHandoffRequest(message: string): boolean {
  if (typeof message !== "string") return false;
  const normalized = message
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/^[^\w]+|[^\w]+$/g, "")
    .replace(/\s+/g, " ");
  if (!normalized || normalized.length > 500) return false;

  if (EXPLICIT_HANDOFF_DIRECT_PHRASE_PATTERN.test(normalized)) {
    return true;
  }

  const hasExplicitActionOrDesire =
    EXPLICIT_HANDOFF_ACTION_PATTERN.test(normalized) ||
    EXPLICIT_HANDOFF_DESIRE_PATTERN.test(normalized) ||
    EXPLICIT_HANDOFF_CONTACT_SUPPORT_PATTERN.test(normalized) ||
    EXPLICIT_HANDOFF_TEAM_HELP_PATTERN.test(normalized);

  if (!hasExplicitActionOrDesire) return false;

  if (
    EXPLICIT_HANDOFF_FALSE_POSITIVE_PATTERN.test(normalized) &&
    !/\b(?:talk|speak|connect|transfer)\s+(?:me\s+)?(?:to|with)\s+(?:a\s+|an\s+)?(?:human|real\s+person|live\s+agent)\b/i.test(normalized)
  ) {
    return false;
  }

  return true;
}

export function explicitHandoffResponseMessage(
  handoffIntro: string,
  handoffEnabled: boolean,
  behavior: UnknownAnswerBehavior = DEFAULT_UNKNOWN_ANSWER_BEHAVIOR,
  customMessage: string = DEFAULT_UNKNOWN_ANSWER_MESSAGE,
): string {
  if (!handoffEnabled) {
    if (behavior === "custom_message" && customMessage.trim()) {
      return customMessage.trim();
    }
    return "Human support requests aren’t available right now, but you can continue asking questions here and I’ll help using our knowledge base.";
  }
  const intro = cleanMessage(handoffIntro, DEFAULT_HANDOFF_INTRO, 500);
  return `I can help connect you with our support team. ${intro}`;
}

export function normalizeAbstentionText(text: string): string {
  return text.trim().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
}

export function isKnownAbstentionMessage(
  content: string,
  configuredFallback?: string,
): boolean {
  if (typeof content !== "string") return false;
  const normalized = normalizeAbstentionText(content);
  if (!normalized) return false;

  if (configuredFallback && normalized === normalizeAbstentionText(configuredFallback)) {
    return true;
  }

  if (normalized === normalizeAbstentionText(DEFAULT_UNKNOWN_ANSWER_MESSAGE)) {
    return true;
  }

  return normalized.startsWith(
    "I'm sorry, but the knowledge base doesn't contain enough information to answer that.",
  );
}

export function countConsecutiveAbstentions(
  messages: ReadonlyArray<{ role: string; content: string }>,
  configuredFallback?: string,
): number {
  let count = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "user") continue;
    if (msg.role !== "assistant") continue;
    if (isKnownAbstentionMessage(msg.content, configuredFallback)) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

export function evaluateEscalationTrigger(input: {
  message: string;
  isAbstention: boolean;
  consecutiveAbstentions: number;
  handoffEnabled: boolean;
  unknownAnswerBehavior: UnknownAnswerBehavior;
}): {
  shouldOfferHandoff: boolean;
  reason: EscalationReason | null;
} {
  if (!input.handoffEnabled) {
    return { shouldOfferHandoff: false, reason: null };
  }

  if (isExplicitHumanHandoffRequest(input.message)) {
    return { shouldOfferHandoff: true, reason: "explicit_request" };
  }

  if (!input.isAbstention) {
    return { shouldOfferHandoff: false, reason: null };
  }

  if (input.consecutiveAbstentions >= REPEATED_ABSTENTION_THRESHOLD) {
    return { shouldOfferHandoff: true, reason: "repeated_failures" };
  }

  if (
    input.unknownAnswerBehavior === "offer_handoff" ||
    input.unknownAnswerBehavior === "contact_support"
  ) {
    return { shouldOfferHandoff: true, reason: "insufficient_evidence" };
  }

  return { shouldOfferHandoff: false, reason: null };
}
