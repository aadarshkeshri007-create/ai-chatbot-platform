export type ChatRequestLock = { current: boolean };

export function tryStartChatRequest(lock: ChatRequestLock): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export function finishChatRequest(lock: ChatRequestLock): void {
  lock.current = false;
}
