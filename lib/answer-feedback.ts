export type FeedbackLock = { current: boolean };

export type FeedbackSubmissionResult =
  | { status: "saved" }
  | { status: "failed"; error: unknown }
  | { status: "busy" };

/** Serializes one answer's feedback submission and reports success only after persistence. */
export async function submitFeedbackOnce(
  lock: FeedbackLock,
  submit: () => Promise<void>,
): Promise<FeedbackSubmissionResult> {
  if (lock.current) return { status: "busy" };
  lock.current = true;
  try {
    await submit();
    return { status: "saved" };
  } catch (error) {
    return { status: "failed", error };
  } finally {
    lock.current = false;
  }
}
