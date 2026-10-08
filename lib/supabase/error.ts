type SupabaseError = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

/*
 * PostgREST reports a column that is not in the schema cache with 42703 for
 * reads and PGRST204 for writes.
 */
export function isMissingSchemaFieldError(
  error?: SupabaseError | null,
): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

export function logSupabaseError(
  context: string,
  error: SupabaseError | null | undefined,
) {
  const details = {
    message: error?.message ?? null,
    code: error?.code ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
  };

  // Log the fields as a readable string as well as an object: some consoles
  // render the object as {} and lose the diagnostic details.
  console.error(`${context} ${JSON.stringify(details)}`, details);
}
