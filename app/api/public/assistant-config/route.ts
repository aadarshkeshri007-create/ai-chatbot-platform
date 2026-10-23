import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicAssistantConfigHandlers } from "@/lib/public-assistant-config";
import { isMissingSchemaFieldError } from "@/lib/supabase/error";

const handlers = createPublicAssistantConfigHandlers(async (assistantId) => {
    const supabase = createAdminClient();
    const current = await supabase
      .from("profiles")
      .select("brand_color, allowed_domains, handoff_enabled, handoff_intro")
      .eq("assistant_id", assistantId)
      .maybeSingle();
    if (!isMissingSchemaFieldError(current.error)) return current;
    return await supabase
      .from("profiles")
      .select("brand_color, allowed_domains")
      .eq("assistant_id", assistantId)
      .maybeSingle();
});

export const GET = handlers.GET;
export const OPTIONS = handlers.OPTIONS;
