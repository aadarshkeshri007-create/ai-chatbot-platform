import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoredWidgetMessage, WidgetRestoreStore } from "./widget-restore.ts";

/**
 * Service-role backed store. The service-role client is only ever constructed
 * server-side (createAdminClient); visitors never receive database access, and
 * every query below is scoped by assistant AND hashed visitor session.
 * The conversations/messages tables are reused as-is: no schema change.
 */
export function createSupabaseWidgetRestoreStore(supabase: SupabaseClient): WidgetRestoreStore {
  return {
    async detachStaleConversation(assistantId, sessionHash, cutoff) {
      // Conditional single-statement update: atomic and idempotent. The row and
      // its messages are retained; only the visitor-session link is removed, so
      // the same browser token can start a brand-new conversation afterwards.
      const { data, error } = await supabase.from("conversations")
        .update({ visitor_session_hash: null })
        .eq("assistant_id", assistantId)
        .eq("visitor_session_hash", sessionHash)
        .lt("updated_at", cutoff.toISOString())
        .select("id");
      if (error) throw error;
      return Array.isArray(data) && data.length > 0;
    },
    async findConversation(assistantId, sessionHash) {
      const { data, error } = await supabase.from("conversations")
        .select("id")
        .eq("assistant_id", assistantId)
        .eq("visitor_session_hash", sessionHash)
        .maybeSingle();
      if (error) throw error;
      return data ? { id: data.id as string } : null;
    },
    async listRecentMessages(conversationId, limit) {
      const { data, error } = await supabase.from("messages")
        .select("role, content, created_at, sources, client_message_id")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as StoredWidgetMessage[];
    },
  };
}
