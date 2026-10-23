"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generateClientUuid } from "@/lib/client-uuid";
import { getDocumentLoadDiagnostics, getDocumentLoadUserMessage } from "@/lib/document-load-error";
import PageFrame from "@/components/PageFrame";
import PageHeader from "@/components/PageHeader";

type Document = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  status: string;
  created_at: string;
  chunk_count: number | null;
  processed_at: string | null;
  extraction_preview: string | null;
  processing_error: string | null;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const ALLOWED_TYPES = [
  "application/pdf",
];

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function UploadPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoadState, setDocumentsLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [documentsLoadError, setDocumentsLoadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [processResult, setProcessResult] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("documents")
        .select(
          "id, file_name, file_path, file_type, file_size, status, created_at, chunk_count, processed_at, extraction_preview, processing_error",
        )
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        const diagnostics = getDocumentLoadDiagnostics(error);
        console.error("[documents.list] load-failed", diagnostics);
        setDocumentsLoadError(getDocumentLoadUserMessage(error));
        setDocumentsLoadState("error");
        return;
      }

      setDocuments(data ?? []);
      setDocumentsLoadState("loaded");
    } catch (loadError) {
      console.error("[documents.list] unexpected-load-failure", getDocumentLoadDiagnostics(loadError));
      setDocumentsLoadError(getDocumentLoadUserMessage(loadError));
      setDocumentsLoadState("error");
    }
  }, []);

  useEffect(() => {
    // This effect synchronizes the page with Supabase; state updates occur only after the async request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocuments();
  }, [loadDocuments]);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    setError("");
    setSuccess("");
    setProcessResult("");
    setUploading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "You must be logged in to upload documents.",
        );
      }

      for (const file of Array.from(files)) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          throw new Error(
            `${file.name} is not a supported file type.`,
          );
        }

        if (file.size > MAX_FILE_SIZE) {
          throw new Error(
            `${file.name} is larger than the 20 MB limit.`,
          );
        }

        const fileId = generateClientUuid();

        const filePath = `${user.id}/${fileId}-${file.name}`;

        const { error: uploadError } =
          await supabase.storage
            .from("knowledge-base")
            .upload(
              filePath,
              file,
              {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type,
              },
            );

        if (uploadError) {
          throw uploadError;
        }

        const {
          data: document,
          error: documentError,
        } = await supabase
          .from("documents")
          .insert({
            user_id: user.id,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            status: "uploaded",
          })
          .select()
          .single();

        if (documentError) {
          await supabase.storage
            .from("knowledge-base")
            .remove([filePath]);

          throw documentError;
        }

        setDocuments((prev) => [
          document,
          ...prev,
        ]);
      }

      setSuccess(
        files.length === 1
          ? "Document uploaded successfully."
          : `${files.length} documents uploaded successfully.`,
      );
    } catch (error) {
      console.error(
        "Error uploading document:",
        error,
      );

      setError(
        error instanceof Error &&
          /not a supported file type|larger than the 20 MB limit|logged in to upload/i.test(
            error.message,
          )
          ? error.message
          : "Something went wrong while uploading. Please try again.",
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleProcessDocument = async (
    documentId: string,
  ) => {
    setError("");
    setSuccess("");
    setProcessResult("");
    setProcessingId(documentId);

    /*
     * Immediately show processing state in the UI.
     * The backend also persists this status in Supabase.
     */
    setDocuments((prev) =>
      prev.map((document) =>
        document.id === documentId
          ? {
            ...document,
            status: "processing",
          }
          : document,
      ),
    );

    try {
      const response = await fetch(
        "/api/documents/process",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            documentId,
          }),
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Failed to process document.",
        );
      }

      console.log(
        "Process result:",
        result,
      );

      setProcessResult(
        `Success: ${result.message} Extracted ${result.extractedCharacters.toLocaleString()} characters, created ${result.chunkCount} chunks, and generated ${result.embeddingDimensions}-dimensional embeddings.`,
      );

      /*
       * Refresh the document list so the latest
       * processing status is visible.
       */
      const supabase = createClient();

      const { data, error } =
        await supabase
          .from("documents")
          .select(
            "id, file_name, file_path, file_type, file_size, status, created_at, chunk_count, processed_at, extraction_preview, processing_error",
          )
          .order("created_at", {
            ascending: false,
          });

      if (!error) {
        setDocuments(data ?? []);
      }
    } catch (error) {
      console.error(
        "Error processing document:",
        error,
      );

      /*
       * Show failed state immediately if the API
       * reports an error.
       */
      setDocuments((prev) =>
        prev.map((document) =>
          document.id === documentId
            ? {
              ...document,
              status: "failed",
            }
            : document,
        ),
      );

      setError(
        "Document processing failed. Please try again.",
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteDocument = async (
    documentId: string,
  ) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this document? This will also delete its indexed chunks and cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");
    setProcessResult("");
    setDeletingId(documentId);

    try {
      const response = await fetch(
        "/api/documents/delete",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            documentId,
          }),
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Failed to delete document.",
        );
      }

      setDocuments((prev) =>
        prev.filter(
          (document) =>
            document.id !== documentId,
        ),
      );

      setSuccess(
        "Document deleted successfully.",
      );
    } catch (error) {
      console.error(
        "Error deleting document:",
        error,
      );

      setError(
        "Document deletion failed. Please try again.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <PageFrame>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Training source"
          title="Knowledge base"
          description="Manage the documents SupportAI can use to ground customer answers."
        />

        <section className="mb-8 border-b border-[var(--border)] pb-7">
          <div
            className={`workspace-surface flex flex-col items-start gap-4 p-5 text-left sm:flex-row sm:items-center sm:p-6 ${uploading ? "border-[var(--focus)] bg-[var(--accent-soft)]" : ""}`}
          >

            {/* Upload icon */}
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent-soft)] text-[var(--accent-link)]"
            >
              {/* Document */}
              <div className="relative">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-8 w-8 text-[var(--accent-link)] dark:text-[var(--accent-link)]"
                >
                  <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <path
                    d="M14 2v6h6"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <path
                    d="M8 13h8M8 17h5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>

                {/* Upload arrow */}
                <div className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-3.5 w-3.5"
                  >
                    <path
                      d="M12 16V4M7 9l5-5 5 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
              {uploading
                ? "Uploading your documents..."
                : "Build your knowledge base"}
            </h2>

            <p className="mt-1 max-w-xl text-sm leading-5 text-[var(--text-secondary)]">
              {uploading
                ? "Securely uploading your files to your AI knowledge base."
                : "Upload PDF documents up to 20 MB each. Your AI assistant will be able to answer questions based on the content of these documents."}
            </p>

            {/* Upload button */}
            <button
              type="button"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={uploading}
              className="mt-3 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
            >
              {uploading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Uploading...
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4 w-4"
                  >
                    <path
                      d="M12 16V4M7 9l5-5 5 5M5 20h14"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Choose files
                </>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_TYPES.join(",")}
              multiple
              onChange={handleFileSelect}
              className="sr-only"
              aria-label="Choose documents to upload"
            />

            </div>
            {/* Animated upload progress */}
            {uploading && (
              <div className="relative mt-7 w-full max-w-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[var(--accent-link)] dark:text-[var(--accent-link)]">
                    Uploading securely
                  </span>

                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Please wait...
                  </span>
                </div>

                <div className="relative h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)] dark:bg-[var(--surface-muted)]">
                  <div className="absolute inset-y-0 left-0 w-1/2 animate-[uploading_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />
                </div>
              </div>
            )}

            <p className="mt-3 text-xs text-[var(--text-secondary)]">
              Maximum file size: 20 MB per file
            </p>
          </div>
          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--error)_25%,var(--border))] bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error)] dark:border-[color-mix(in_srgb,var(--error)_35%,var(--border))] dark:bg-[var(--error-soft)] dark:text-[var(--error)]">
              {error}
            </p>
          )}

          {success && (
            <p role="status" aria-live="polite" className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--success)_30%,var(--border))] bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success)] dark:border-[color-mix(in_srgb,var(--success)_30%,var(--border))] dark:bg-[var(--success-soft)] dark:text-[var(--success)]">
              {success}
            </p>
          )}

          {processResult && (
            <p role="status" aria-live="polite" className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--accent)_30%,var(--border))] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-link)] dark:border-[color-mix(in_srgb,var(--accent)_30%,var(--border))] dark:bg-[var(--accent-soft)] dark:text-[var(--accent-link)]">
              {processResult}
            </p>
          )}
        </section>

        <section className="mb-8 mt-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Documents</h2>
            <span className="text-xs text-[var(--text-secondary)]">{documents.length} {documents.length === 1 ? "file" : "files"}</span>
          </div>

          {documentsLoadState === "loading" ? (
            <p role="status" aria-live="polite" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center text-sm text-[var(--text-secondary)] dark:border-[var(--border)] dark:bg-[var(--surface)] dark:text-[var(--text-secondary)]">
              Loading your documents...
            </p>
          ) : documentsLoadState === "error" ? (
            <div role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--error)_25%,var(--border))] bg-[var(--error-soft)] px-5 py-5 text-sm text-[var(--error)] dark:border-[color-mix(in_srgb,var(--error)_35%,var(--border))] dark:bg-[var(--error-soft)] dark:text-[var(--error)]">
              <p>{documentsLoadError}</p>
              <button
                type="button"
                onClick={() => {
                  setDocumentsLoadState("loading");
                  void loadDocuments();
                }}
                className="mt-3 min-h-11 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--error)_35%,var(--border))] px-4 py-2 font-medium transition hover:bg-[var(--error-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--error)] focus-visible:ring-offset-2"
              >
                Retry loading documents
              </button>
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center text-sm text-[var(--text-secondary)] dark:border-[var(--border)] dark:bg-[var(--surface)] dark:text-[var(--text-secondary)]">
              No documents uploaded yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] dark:border-[var(--border)] dark:bg-[var(--surface)]">
              {documents.map(
                (document) => (
                  <div
                    key={document.id}
                    className="border-b border-[var(--border)] px-4 py-3.5 sm:px-5 sm:py-4 last:border-b-0 dark:border-[var(--border)]"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface-muted)] text-[var(--accent-link)]" aria-hidden="true">
                          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                            <path
                              d="M5 3.5A1.5 1.5 0 0 1 6.5 2h5.086a1.5 1.5 0 0 1 1.06.44l2.914 2.914a1.5 1.5 0 0 1 .44 1.06V16.5A1.5 1.5 0 0 1 14.5 18h-8A1.5 1.5 0 0 1 5 16.5v-13Z"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M12.5 2v3.5a1 1 0 0 0 1 1h3.5M8 10.5h4M8 13.5h4"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--text-primary)] dark:text-[var(--text-primary)]">
                            {document.file_name}
                          </p>

                          <p className="mt-0.5 text-xs text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
                            {formatFileSize(document.file_size)} · {document.file_type || "Unknown file type"}
                          </p>

                          {document.status === "processed" && (
                            <p className="mt-1 text-xs text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
                              {typeof document.chunk_count === "number" ? `${document.chunk_count} chunks` : "Chunk count unavailable"}
                              {document.processed_at && ` · Processed ${new Date(document.processed_at).toLocaleString()}`}
                            </p>
                          )}

                          {document.status ===
                            "processing" && (
                              <div className="mt-3 w-full max-w-sm">
                                <div className="mb-1.5 flex items-center justify-between">
                                  <span className="text-[11px] font-medium text-[var(--accent-link)] dark:text-[var(--accent-link)]">
                                    Indexing document...
                                  </span>

                                  <span className="text-[11px] text-[var(--text-secondary)]">In progress</span>
                                </div>

                                <div className="relative h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)] dark:bg-[var(--surface-muted)]">
                                  <div className="absolute inset-y-0 left-0 w-1/2 animate-[loading_1.5s_ease-in-out_infinite] rounded-full bg-[var(--accent)]" />
                                </div>
                              </div>
                            )}

                          {document.status ===
                            "failed" && (
                              <p className="mt-2 text-xs text-[var(--error)] dark:text-[var(--error)]">
                                {document.processing_error || "Processing failed. You can retry."}
                              </p>
                            )}

                          {document.status === "processed" && document.extraction_preview && (
                            <details className="mt-2 max-w-2xl rounded-lg border border-[var(--border)] px-3 py-2 text-xs dark:border-[var(--border)]">
                              <summary className="cursor-pointer font-medium text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">View extracted text preview</summary>
                              <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">{document.extraction_preview}</p>
                            </details>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center justify-start sm:justify-end gap-2 sm:gap-3 pt-1 sm:pt-0">
                        {document.status ===
                          "processing" ? (
                          <div className="flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 dark:bg-[var(--accent-soft)]">
                          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />

                            <span className="text-xs font-medium text-[var(--accent-link)] dark:text-[var(--accent-link)]">
                              Processing
                            </span>
                          </div>
                        ) : document.status ===
                          "processed" ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-xs font-medium text-[var(--success)] dark:bg-[var(--success-soft)] dark:text-[var(--success)]">
                            <span aria-hidden="true">✓</span>
                            Processed
                          </span>
                        ) : document.status ===
                          "failed" ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-[var(--error-soft)] px-2.5 py-1 text-xs font-medium text-[var(--error)] dark:bg-[var(--error-soft)] dark:text-[var(--error)]">
                            <span>!</span>
                            Failed
                          </span>
                        ) : (
                          <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] dark:bg-[var(--surface-muted)] dark:text-[var(--text-secondary)]">
                            Uploaded
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            handleProcessDocument(
                              document.id,
                            )
                          }
                          disabled={
                            processingId ===
                            document.id ||
                            deletingId ===
                            document.id ||
                            document.status ===
                            "processing"
                          }
                          className="min-h-10 rounded-[var(--radius-control)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                        >
                          {processingId ===
                            document.id
                            ? "Processing..."
                            : document.status ===
                              "failed"
                              ? "Retry"
                              : document.status ===
                                "processed"
                                ? "Reprocess"
                                : "Process"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteDocument(
                              document.id,
                            )
                          }
                          disabled={
                            processingId ===
                            document.id ||
                            deletingId ===
                            document.id
                          }
                          className="min-h-10 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--error)_25%,var(--border))] px-3 py-1.5 text-xs font-medium text-[var(--error)] transition hover:bg-[var(--error-soft)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--error)] focus-visible:ring-offset-2"
                        >
                          {deletingId ===
                            document.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      </div>
    </PageFrame>
  );
}
