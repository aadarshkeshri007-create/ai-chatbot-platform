import {
  DEFAULT_BRAND_COLOR,
  getBrandLinkColor,
  getBrandTextColor,
  normalizeBrandColor,
} from "./brand-color.ts";
import {
  hasDisallowedPublicChatOrigin,
  isAllowedAssistantOrigin,
  publicChatJson,
  publicChatOptions,
} from "./public-chat-cors.ts";

const assistantIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublicAssistantConfigRecord = {
  brand_color: unknown;
  allowed_domains: string[] | null;
};

export type AssistantConfigLookup = (
  assistantId: string,
) => Promise<{ data: PublicAssistantConfigRecord | null; error?: unknown }>;

export function isPublicAssistantConfigRequest(method: string, pathname: string): boolean {
  return pathname === "/api/public/assistant-config" &&
    (method === "GET" || method === "OPTIONS");
}

export function createPublicAssistantConfigHandlers(lookupAssistant: AssistantConfigLookup) {
  return {
    async GET(request: Request): Promise<Response> {
      if (hasDisallowedPublicChatOrigin(request)) {
        return publicChatJson(request, { error: "Origin is not allowed." }, { status: 403 });
      }

      const assistantId = new URL(request.url).searchParams.get("assistant_id");
      if (!assistantId || !assistantIdPattern.test(assistantId)) {
        return publicChatJson(request, { error: "A valid assistant ID is required." }, { status: 400 });
      }

      try {
        const { data, error } = await lookupAssistant(assistantId);
        if (error) {
          return publicChatJson(request, { error: "Assistant configuration is unavailable." }, { status: 503 });
        }
        if (!data) {
          return publicChatJson(request, { error: "Assistant configuration is unavailable." }, { status: 404 });
        }
        if (!isAllowedAssistantOrigin(request, data.allowed_domains)) {
          return publicChatJson(request, { error: "Origin is not allowed for this assistant." }, { status: 403 }, data.allowed_domains);
        }

        const brandColor = normalizeBrandColor(data.brand_color) ?? DEFAULT_BRAND_COLOR;
        return publicChatJson(request, {
          brand_color: brandColor,
          brand_text_color: getBrandTextColor(brandColor),
          brand_link_color: getBrandLinkColor(brandColor),
        }, { headers: { "Cache-Control": "no-store" } }, data.allowed_domains);
      } catch {
        return publicChatJson(request, { error: "Assistant configuration is unavailable." }, { status: 503 });
      }
    },

    OPTIONS(request: Request): Response {
      if (hasDisallowedPublicChatOrigin(request)) {
        return publicChatJson(request, { error: "Origin is not allowed." }, { status: 403 });
      }
      return publicChatOptions(request, "GET, OPTIONS");
    },
  };
}
