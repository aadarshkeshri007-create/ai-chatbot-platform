/**
 * Visitor session token persistence for the host-page loader (widget.js).
 *
 * These functions are embedded into the generated widget.js with
 * `Function.prototype.toString()`, so each one MUST be fully self-contained:
 * no imports, no module-level constants, no TypeScript-only runtime helpers.
 *
 * Storage runs on the CLIENT WEBSITE's origin, so the browser itself isolates
 * different client sites; the key also includes the assistant id so two
 * assistants on one site never share a token. The token is an opaque resume
 * credential: the server only stores its SHA-256 hash.
 *
 * Durability: the token lives in localStorage so a visitor can return after
 * closing the browser. A token found only in sessionStorage (written by an
 * earlier widget version) is migrated forward so in-progress conversations are
 * not lost on upgrade. If storage is blocked, callers fall back to memory.
 */
export function loadVisitorSessionToken(
  getStorages: Array<() => Storage>,
  key: string,
  createToken: () => string,
): string {
  const valid = /^[A-Za-z0-9_-]{40,100}$/;
  const stores: Storage[] = [];
  for (const get of getStorages) {
    try { stores.push(get()); } catch { /* Storage blocked by privacy settings. */ }
  }
  let token = "";
  for (const store of stores) {
    try {
      const value = store.getItem(key) || "";
      if (valid.test(value)) { token = value; break; }
    } catch { /* Ignore unreadable storage. */ }
  }
  if (!token) token = createToken();
  for (const store of stores) {
    try { store.setItem(key, token); } catch { /* Keep the token in memory. */ }
  }
  return token;
}

export function saveVisitorSessionToken(
  getStorages: Array<() => Storage>,
  key: string,
  token: string,
): void {
  for (const get of getStorages) {
    try { get().setItem(key, token); } catch { /* Keep the token in memory. */ }
  }
}
