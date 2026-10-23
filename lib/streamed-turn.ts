export async function completeAfterPersistence<T>(
  persist: () => Promise<T | null>,
  onComplete: (value: T) => void,
  onFailure: () => void,
): Promise<boolean> {
  try {
    const value = await persist();
    if (value === null) {
      onFailure();
      return false;
    }
    onComplete(value);
    return true;
  } catch {
    onFailure();
    return false;
  }
}
