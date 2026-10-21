import assert from "node:assert/strict";
import test from "node:test";
import {
  createDocumentProcessingDiagnostics,
  DOCUMENT_PREVIEW_LIMIT,
  getSafeDocumentProcessingError,
} from "./document-processing.ts";

test("document diagnostics bound extracted previews and preserve chunk counts", () => {
  const result = createDocumentProcessingDiagnostics("x".repeat(2500), 3);

  assert.equal(result.chunk_count, 3);
  assert.equal(result.extraction_preview.length, DOCUMENT_PREVIEW_LIMIT);
  assert.equal(result.processing_error, null);
  assert.ok(Number.isFinite(Date.parse(result.processed_at)));
});

test("processing errors expose a safe extraction diagnostic, not provider details", () => {
  assert.match(
    getSafeDocumentProcessingError(new Error("No extractable text was found in this PDF.")),
    /Scanned PDFs need OCR/,
  );
  assert.equal(
    getSafeDocumentProcessingError(new Error("provider response containing private data")),
    "Processing failed. Check the document and service configuration, then retry.",
  );
});
