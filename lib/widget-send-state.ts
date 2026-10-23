export function canSubmitWidgetMessage(
  message: string,
  options: {
    loading: boolean;
    handoffActive: boolean;
    assistantReady: boolean;
    submissionPending: boolean;
  },
): boolean {
  return Boolean(message.trim()) &&
    options.assistantReady &&
    !options.loading &&
    !options.handoffActive &&
    !options.submissionPending;
}
