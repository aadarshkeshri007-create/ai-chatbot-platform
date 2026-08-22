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
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
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
       * Refresh the document list so the
       * latest processing status is visible.
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

      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong while processing.",
      );
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Knowledge Base
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Upload documents that your AI
            assistant can use to answer
            customer questions.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-6 py-12 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-2xl">
              📄
            </div>

            <h2 className="text-base font-semibold text-slate-900">
              Upload your documents
            </h2>

            <p className="mt-2 max-w-md text-sm text-slate-500">
              Upload PDF, DOCX, TXT, or
              Markdown files up to 20 MB
              each.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md"
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              type="button"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={uploading}
              className="mt-6 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading
                ? "Uploading..."
                : "Choose files"}
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {success && (
            <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </p>
          )}

          {processResult && (
            <p className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
              {processResult}
            </p>
          )}
        </section>

        <section className="mt-8">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Your documents
          </h2>

          {documents.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
              No documents uploaded yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {documents.map(
                (document) => (
                  <div
                    key={document.id}
                    className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm">
                        📄
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {
                            document.file_name
                          }
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatFileSize(
                            document.file_size,
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {
                          document.status
                        }
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          handleProcessDocument(
                            document.id,
                          )
                        }
                        disabled={
                          processingId ===
                          document.id
                        }
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {processingId ===
                        document.id
                          ? "Processing..."
                          : "Process"}
                      </button>
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