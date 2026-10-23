import assert from "node:assert/strict";
import test from "node:test";
import { loadVisitorSessionToken, saveVisitorSessionToken } from "./widget-session-storage.ts";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

let counter = 0;
const makeToken = () => `tok${String(++counter).padStart(2, "0")}${"x".repeat(40)}`;
const KEY = "supportai:visitor-session:11111111-1111-4111-8111-111111111111";
const OTHER_KEY = "supportai:visitor-session:22222222-2222-4222-8222-222222222222";

function browser() {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  return {
    local,
    session,
    getters: [() => local as unknown as Storage, () => session as unknown as Storage],
    // Closing the browser keeps localStorage and discards sessionStorage.
    restart() { session.clear(); },
  };
}

test("a new visitor gets a high-entropy-shaped token persisted durably", () => {
  const b = browser();
  const token = loadVisitorSessionToken(b.getters, KEY, makeToken);
  assert.match(token, /^[A-Za-z0-9_-]{40,100}$/);
  assert.equal(b.local.getItem(KEY), token);
});

test("the same token is reused after a page refresh and after a simulated browser restart", () => {
  const b = browser();
  const first = loadVisitorSessionToken(b.getters, KEY, makeToken);
  assert.equal(loadVisitorSessionToken(b.getters, KEY, makeToken), first, "refresh");
  b.restart();
  assert.equal(loadVisitorSessionToken(b.getters, KEY, makeToken), first, "browser restart");
});

test("tokens written by earlier sessionStorage-only builds are migrated, not discarded", () => {
  const b = browser();
  const legacy = makeToken();
  b.session.setItem(KEY, legacy);
  assert.equal(loadVisitorSessionToken(b.getters, KEY, makeToken), legacy);
  b.restart();
  assert.equal(loadVisitorSessionToken(b.getters, KEY, makeToken), legacy, "survives restart after migration");
});

test("storage keys are scoped per assistant so tenants never share a token", () => {
  const b = browser();
  const a = loadVisitorSessionToken(b.getters, KEY, makeToken);
  const other = loadVisitorSessionToken(b.getters, OTHER_KEY, makeToken);
  assert.notEqual(a, other);
  assert.equal(b.local.getItem(KEY), a);
  assert.equal(b.local.getItem(OTHER_KEY), other);
});

test("malformed stored tokens are replaced instead of being sent to the server", () => {
  const b = browser();
  b.local.setItem(KEY, "short");
  const token = loadVisitorSessionToken(b.getters, KEY, makeToken);
  assert.notEqual(token, "short");
  assert.match(token, /^[A-Za-z0-9_-]{40,100}$/);
});

test("starting a new conversation rotates the token in every store without touching other assistants", () => {
  const b = browser();
  const old = loadVisitorSessionToken(b.getters, KEY, makeToken);
  const other = loadVisitorSessionToken(b.getters, OTHER_KEY, makeToken);
  const fresh = makeToken();
  saveVisitorSessionToken(b.getters, KEY, fresh);
  b.restart();
  assert.notEqual(loadVisitorSessionToken(b.getters, KEY, makeToken), old);
  assert.equal(loadVisitorSessionToken(b.getters, KEY, makeToken), fresh);
  assert.equal(loadVisitorSessionToken(b.getters, OTHER_KEY, makeToken), other);
});

test("blocked or throwing storage falls back to an in-memory token without throwing", () => {
  const blocked = [
    () => { throw new Error("SecurityError"); },
    () => ({ getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } }) as unknown as Storage,
  ];
  const token = loadVisitorSessionToken(blocked, KEY, makeToken);
  assert.match(token, /^[A-Za-z0-9_-]{40,100}$/);
  assert.doesNotThrow(() => saveVisitorSessionToken(blocked, KEY, makeToken()));
});

test("the helpers stay self-contained so they can be embedded into widget.js via toString()", () => {
  const embeddedLoad = new Function(`return (${loadVisitorSessionToken.toString()});`)() as typeof loadVisitorSessionToken;
  const embeddedSave = new Function(`return (${saveVisitorSessionToken.toString()});`)() as typeof saveVisitorSessionToken;
  const b = browser();
  const token = embeddedLoad(b.getters, KEY, makeToken);
  b.restart();
  assert.equal(embeddedLoad(b.getters, KEY, makeToken), token);
  const fresh = makeToken();
  embeddedSave(b.getters, KEY, fresh);
  assert.equal(b.local.getItem(KEY), fresh);
});
