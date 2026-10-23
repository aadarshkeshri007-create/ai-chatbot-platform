export const DOCUMENT_PREVIEW_LIMIT = 2000;

const EMPTY_TEXT_FAILURE = "No extractable text was found in this PDF.";
const EMPTY_TEXT_DIAGNOSTIC =
  "No selectable text was extracted. Scanned PDFs need OCR, which is not currently supported.";
const GENERIC_PROCESSING_DIAGNOSTIC =
  "Processing failed. Check the document and service configuration, then retry.";

export function getSafeDocumentProcessingError(error: unknown): string {
  return error instanceof Error && error.message === EMPTY_TEXT_FAILURE
    ? EMPTY_TEXT_DIAGNOSTIC
    : GENERIC_PROCESSING_DIAGNOSTIC;
}

export function createDocumentProcessingDiagnostics(text: string, chunkCount: number) {
  return {
    chunk_count: Math.max(0, Math.floor(chunkCount)),
    extraction_preview: text.slice(0, DOCUMENT_PREVIEW_LIMIT),
    processed_at: new Date().toISOString(),
    processing_error: null,
  };
}
