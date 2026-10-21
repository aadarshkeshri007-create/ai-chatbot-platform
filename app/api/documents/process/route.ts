import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getPath } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createDocumentProcessingDiagnostics,
  getSafeDocumentProcessingError,
} from "@/lib/document-processing";
import { getFaqProcessingResult } from "@/lib/testing-playground";

export const runtime = "nodejs";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_CHUNKS = 2000;
const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

function logProcessingFailure(category: string) {
  console.error(`[documents.process] ${category}`);
}

function createChunks(text: string) {
  const chunks: string[] = [];

  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);

    const chunk = text.slice(start, end).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= text.length) {
      break;
    }

    start = end - CHUNK_OVERLAP;
  }

  return chunks;
}

PDFParse.setWorker(getPath());

export async function POST(request: Request) {
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  let documentId: string | null = null;
  let userId: string | null = null;

  try {
    supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    userId = user.id;

    const body = await request.json();
    documentId = body.documentId;

    if (!documentId || typeof documentId !== "string") {
      return NextResponse.json(
        {
          error: "Document ID is required.",
        },
        { status: 400 },
      );
    }

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id, user_id, file_name, file_path, file_type, file_size, status")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single();

    if (documentError || !document) {
      return NextResponse.json(
        {
          error: "Document not found.",
        },
        { status: 404 },
      );
    }

    if (document.file_size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "File is too large. Maximum file size is 20 MB.",
        },
        { status: 400 },
      );
    }

    /*
     * Mark the document as processing
     * before doing any expensive work.
     */
    const { error: processingStatusError } = await supabase
      .from("documents")
      .update({
        status: "processing",
        chunk_count: 0,
        processed_at: null,
        extraction_preview: null,
        processing_error: null,
      })
      .eq("id", document.id)
      .eq("user_id", user.id);

    if (processingStatusError) {
      logProcessingFailure("processing-status-update-failed");

      return NextResponse.json(
        {
          error: "Failed to update document processing status.",
        },
        { status: 500 },
      );
    }
    const admin = createAdminClient();
    const { error: faqProcessingError } = await admin.from("assistant_faq_drafts")
      .update({ status: "processing", processing_error: null, updated_at: new Date().toISOString() })
      .eq("document_id", document.id).eq("owner_user_id", user.id);
    if (faqProcessingError) logProcessingFailure("faq-draft-processing-status-update-failed");

    const { data: file, error: downloadError } = await supabase.storage
      .from("knowledge-base")
      .download(document.file_path);

    if (downloadError || !file) {
      logProcessingFailure("storage-download-failed");

      throw new Error("Unable to download document.");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error("File is too large. Maximum file size is 20 MB.");
    }

    const arrayBuffer = await file.arrayBuffer();

    let text: string;
    if (document.file_type === "application/pdf") {
      const parser = new PDFParse({ data: new Uint8Array(arrayBuffer) });
      try {
        const result = await parser.getText();
        text = result.text.trim();
      } finally {
        await parser.destroy();
      }
    } else if (document.file_type === "text/plain" || document.file_type === "text/markdown") {
      text = new TextDecoder("utf-8", { fatal: true }).decode(arrayBuffer).trim();
    } else {
      throw new Error("This document type is not supported for processing.");
    }

    if (!text) {
      throw new Error("No extractable text was found in this PDF.");
    }

    const chunks = createChunks(text);

    if (chunks.length > MAX_CHUNKS) {
      throw new Error(
        "This document is too large to process. Please upload a smaller document.",
      );
    }

    if (chunks.length === 0) {
      throw new Error("No chunks could be created from this document.");
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    /*
     * Generate one embedding for every chunk.
     *
     * We use RETRIEVAL_DOCUMENT because these
     * chunks are documents that will later be
     * searched using user questions.
     */
    const embeddingResponse = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: chunks,
      config: {
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
    });

    const embeddings = embeddingResponse.embeddings;

    if (!embeddings || embeddings.length !== chunks.length) {
      throw new Error("Embedding count does not match chunk count.");
    }

    const chunkRows = chunks.map((content, index) => {
      const embedding = embeddings[index]?.values;

      if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`Invalid embedding for chunk ${index}.`);
      }

      return {
        document_id: document.id,
        user_id: user.id,
        content,
        chunk_index: index,
        embedding,
      };
    });

    /*
     * Delete existing chunks so that
     * reprocessing the same document does
     * not create duplicates.
     */
    const { error: deleteChunksError } = await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", document.id)
      .eq("user_id", user.id);

    if (deleteChunksError) {
      logProcessingFailure("existing-chunks-delete-failed");

      throw new Error("Unable to reset existing document chunks.");
    }

    const { error: insertChunksError } = await supabase
      .from("document_chunks")
      .insert(chunkRows);

    if (insertChunksError) {
      logProcessingFailure("chunk-insert-failed");

      throw new Error("Unable to save document chunks.");
    }

    const { count: storedChunkCount, error: chunkCountError } = await supabase
      .from("document_chunks")
      .select("id", { count: "exact", head: true })
      .eq("document_id", document.id)
      .eq("user_id", user.id);
    if (chunkCountError || storedChunkCount !== chunks.length) {
      logProcessingFailure("stored-chunk-count-verification-failed");
      throw new Error("Unable to verify stored document chunks.");
    }

    const { error: updateDocumentError } = await supabase
      .from("documents")
      .update({
        status: "processed",
        ...createDocumentProcessingDiagnostics(text, storedChunkCount),
      })
      .eq("id", document.id)
      .eq("user_id", user.id);

    if (updateDocumentError) {
      logProcessingFailure("processed-status-update-failed");

      throw new Error(
        "Chunks were created, but document status could not be updated.",
      );
    }
    const { error: faqProcessedError } = await createAdminClient().from("assistant_faq_drafts")
      .update({ ...getFaqProcessingResult(true, ""), updated_at: new Date().toISOString() })
      .eq("document_id", document.id).eq("owner_user_id", user.id);
    if (faqProcessedError) logProcessingFailure("faq-draft-processed-status-update-failed");

    return NextResponse.json({
      success: true,
      message: "Document processed and embedded successfully.",
      document: {
        id: document.id,
        fileName: document.file_name,
        fileType: document.file_type,
      },
      extractedCharacters: text.length,
      chunkCount: chunks.length,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
    });
  } catch (error) {
    logProcessingFailure("processing-failed");

    /*
     * If anything fails after we marked the
     * document as processing, mark it as failed.
     */
    if (supabase && documentId && userId) {
      const { count: storedChunkCount, error: chunkCountError } = await supabase
        .from("document_chunks")
        .select("id", { count: "exact", head: true })
        .eq("document_id", documentId)
        .eq("user_id", userId);
      if (chunkCountError) {
        logProcessingFailure("failed-chunk-count-verification-failed");
      }
      const { error: failedStatusError } = await supabase
        .from("documents")
        .update({
          status: "failed",
          ...(storedChunkCount === null ? {} : { chunk_count: storedChunkCount ?? 0 }),
          processing_error: getSafeDocumentProcessingError(error),
        })
        .eq("id", documentId)
        .eq("user_id", userId);

      if (failedStatusError) {
        logProcessingFailure("failed-status-update-failed");
      }
      const { error: faqFailedError } = await createAdminClient().from("assistant_faq_drafts")
        .update({ ...getFaqProcessingResult(false, "Knowledge processing failed. Retry from the assistant testing page."), updated_at: new Date().toISOString() })
        .eq("document_id", documentId).eq("owner_user_id", userId);
      if (faqFailedError) logProcessingFailure("faq-draft-failed-status-update-failed");
    }

    return NextResponse.json(
      {
        error: "Unable to process the document right now. Please try again.",
      },
      { status: 500 },
    );
  }
}
