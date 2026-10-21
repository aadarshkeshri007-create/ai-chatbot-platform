import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicAssistantConfigHandlers } from "@/lib/public-assistant-config";

const handlers = createPublicAssistantConfigHandlers(async (assistantId) => {
    const supabase = createAdminClient();
    return await supabase
      .from("profiles")
      .select("brand_color, allowed_domains")
      .eq("assistant_id", assistantId)
      .maybeSingle();
});

export const GET = handlers.GET;
export const OPTIONS = handlers.OPTIONS;
