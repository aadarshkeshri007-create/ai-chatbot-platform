import assert from "node:assert/strict";
import test from "node:test";
import { getDocumentLoadDiagnostics, getDocumentLoadUserMessage } from "./document-load-error.ts";

test("document load diagnostics expose safe Supabase fields without details or secrets", () => {
  const error = Object.assign(new Error("column missing; token=super-secret-value"), {
    code: "42703",
    status: 400,
    details: "private document contents",
  });
  const diagnostics = getDocumentLoadDiagnostics(error);
  assert.equal(diagnostics.name, "Error");
  assert.equal(diagnostics.code, "42703");
  assert.equal(diagnostics.status, 400);
  assert.equal(diagnostics.message, "column missing; token=[redacted]");
  assert.equal(JSON.stringify(diagnostics).includes("private document contents"), false);
  assert.equal(JSON.stringify(diagnostics).includes("super-secret-value"), false);
});

test("document load failures distinguish schema and authorization problems from empty results", () => {
  assert.match(getDocumentLoadUserMessage({ code: "PGRST204" }), /schema is unavailable or out of date/);
  assert.match(getDocumentLoadUserMessage({ code: "42501" }), /not authorized/);
  assert.match(getDocumentLoadUserMessage({}), /Unable to load your documents/);
});

test("unknown and unserializable errors produce bounded diagnostics", () => {
  assert.deepEqual(getDocumentLoadDiagnostics(null), {
    name: undefined,
    message: undefined,
    code: undefined,
    status: undefined,
  });
  assert.equal(getDocumentLoadDiagnostics({ message: "x".repeat(500) }).message?.length, 300);
});
