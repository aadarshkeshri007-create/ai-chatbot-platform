export const DEFAULT_BUSINESS_NAME = "Your Business";
export const DEFAULT_ASSISTANT_NAME = "AI Support";
export const DEFAULT_WELCOME_MESSAGE = "Hello! How can I assist you today?";

export const ASSISTANT_SETTINGS_LIMITS = {
  businessName: 100,
  assistantName: 100,
  welcomeMessage: 500,
  customInstructions: 4000,
} as const;

type AssistantSettingsRow = {
  business_name?: string | null;
  assistant_name?: string | null;
  welcome_message?: string | null;
  custom_instructions?: string | null;
};

const valueOrFallback = (value: string | null | undefined, fallback: string) =>
  value?.trim() || fallback;

export function getAssistantSettings(settings?: AssistantSettingsRow | null) {
  return {
    businessName: valueOrFallback(settings?.business_name, DEFAULT_BUSINESS_NAME),
    assistantName: valueOrFallback(settings?.assistant_name, DEFAULT_ASSISTANT_NAME),
    welcomeMessage: valueOrFallback(
      settings?.welcome_message,
      DEFAULT_WELCOME_MESSAGE,
    ),
    customInstructions: settings?.custom_instructions?.trim() || "",
  };
}
