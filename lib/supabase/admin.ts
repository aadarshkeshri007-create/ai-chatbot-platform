import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only client for the tightly scoped public-chat RPCs.
 *
 * This module must never be imported by client components. The service-role
 * key is intentionally read from a non-public environment variable.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server environment variables are not set");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
