"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Document = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  status: string;
  created_at: string;
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
  const [uploading, setUploading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [processResult, setProcessResult] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loadDocuments = async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("documents")
        .select(
          "id, file_name, file_path, file_type, file_size, status, created_at",
        )
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        console.error(
          "Error loading documents:",
          error,
        );

        setError(
          "Unable to load your documents.",
        );

        return;
      }

      setDocuments(data ?? []);
    };

    loadDocuments();
  }, []);

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

        const fileId = crypto.randomUUID();

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
        error instanceof Error
          ? error.message
          : "Something went wrong while uploading.",
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
            "id, file_name, file_path, file_type, file_size, status, created_at",
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
        error instanceof Error
          ? error.message
          : "Something went wrong while processing.",
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
        error instanceof Error
          ? error.message
          : "Something went wrong while deleting the document.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-10 transition-colors duration-150 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Knowledge Base
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Upload documents that your AI
            assistant can use to answer
            customer questions.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <div
            className={`group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all duration-300 ${uploading
                ? "border-teal-400 bg-teal-50/50 dark:border-teal-500/60 dark:bg-teal-950/20"
                : "border-slate-200 bg-slate-50/50 hover:border-teal-300 hover:bg-teal-50/30 dark:border-slate-700/70 dark:bg-slate-900/40 dark:hover:border-teal-700 dark:hover:bg-teal-950/10"
              }`}
          >
            {/* Ambient glow */}
            <div
              className={`pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-teal-400/10 blur-3xl transition-opacity duration-500 ${uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
            />

            {/* Animated background grid */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.04]">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:24px_24px]" />
            </div>

            {/* Upload icon */}
            <div
              className={`relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-500 ${uploading
                  ? "border-teal-200 bg-white shadow-lg shadow-teal-500/20 dark:border-teal-800 dark:bg-slate-900"
                  : "border-slate-200 bg-white shadow-sm group-hover:-translate-y-1 group-hover:border-teal-200 group-hover:shadow-lg group-hover:shadow-teal-500/10 dark:border-slate-700 dark:bg-slate-900"
                }`}
            >
              {/* Outer pulse */}
              {uploading && (
                <span className="absolute inset-0 animate-ping rounded-2xl border border-teal-400/30" />
              )}

              {/* Document */}
              <div
                className={`relative transition-all duration-500 ${uploading
                    ? "animate-[float_2s_ease-in-out_infinite]"
                    : "group-hover:-translate-y-0.5"
                  }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-8 w-8 text-teal-600 dark:text-teal-400"
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
                <div
                  className={`absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-white shadow-md shadow-teal-500/30 transition-transform duration-500 dark:bg-teal-500 ${uploading
                      ? "animate-bounce"
                      : "group-hover:-translate-y-1"
                    }`}
                >
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

            <h2 className="relative text-base font-semibold text-slate-900 dark:text-slate-100">
              {uploading
                ? "Uploading your documents..."
                : "Build your knowledge base"}
            </h2>

            <p className="relative mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
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
              className="relative mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              {uploading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-slate-950/30 dark:border-t-slate-950" />
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

            {/* Animated upload progress */}
            {uploading && (
              <div className="relative mt-7 w-full max-w-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-teal-600 dark:text-teal-400">
                    Uploading securely
                  </span>

                  <span className="text-[11px] text-slate-400">
                    Please wait...
                  </span>
                </div>

                <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className="absolute inset-y-0 left-0 w-1/2 animate-[uploading_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-transparent via-teal-500 to-transparent" />
                </div>
              </div>
            )}

            <p className="relative mt-4 text-[11px] text-slate-400 dark:text-slate-500">
              Maximum file size: 20 MB per file
            </p>
          </div>
          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          {success && (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              {success}
            </p>
          )}

          {processResult && (
            <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
              {processResult}
            </p>
          )}
        </section>

        <section className="mb-10 mt-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Your documents
          </h2>

          {documents.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              No documents uploaded yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              {documents.map(
                (document) => (
                  <div
                    key={document.id}
                    className="border-b border-slate-100 px-5 py-4 last:border-b-0 dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm dark:bg-slate-800">
                          📄
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                            {document.file_name}
                          </p>

                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {formatFileSize(
                              document.file_size,
                            )}
                          </p>

                          {document.status ===
                            "processing" && (
                              <div className="mt-3 w-full max-w-sm">
                                <div className="mb-1.5 flex items-center justify-between">
                                  <span className="text-[11px] font-medium text-teal-600 dark:text-teal-400">
                                    Indexing document...
                                  </span>

                                  <span className="text-[11px] text-slate-400">
                                    AI
                                  </span>
                                </div>

                                <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                  <div className="absolute inset-y-0 left-0 w-1/2 animate-[loading_1.5s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-transparent via-teal-500 to-transparent" />
                                </div>
                              </div>
                            )}

                          {document.status ===
                            "failed" && (
                              <p className="mt-2 text-xs text-red-500 dark:text-red-400">
                                Processing failed. You can retry.
                              </p>
                            )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
                        {document.status ===
                          "processing" ? (
                          <div className="flex items-center gap-2 rounded-full bg-teal-50 px-2.5 py-1 dark:bg-teal-950/40">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-500" />
                            </span>

                            <span className="text-xs font-medium text-teal-600 dark:text-teal-400">
                              Processing
                            </span>
                          </div>
                        ) : document.status ===
                          "processed" ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <span>✓</span>
                            Processed
                          </span>
                        ) : document.status ===
                          "failed" ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
                            <span>!</span>
                            Failed
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
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
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
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
    </div>
  );
}
