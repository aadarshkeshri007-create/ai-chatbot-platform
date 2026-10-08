type SupabaseError = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

export function logSupabaseError(context: string, error: SupabaseError) {
  console.error(context, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}
