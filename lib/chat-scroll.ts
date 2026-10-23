export function shouldAutoScrollToBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  threshold = 24,
): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}
