import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getPath } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_CHUNKS = 2000;
const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

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
      })
      .eq("id", document.id)
      .eq("user_id", user.id);

    if (processingStatusError) {
      console.error(
        "Error updating document status to processing:",
        processingStatusError,
      );

      return NextResponse.json(
        {
          error: "Failed to update document processing status.",
        },
        { status: 500 },
      );
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from("knowledge-base")
      .download(document.file_path);

    if (downloadError || !file) {
      console.error("Error downloading document:", downloadError);

      throw new Error("Unable to download document.");
    }

    if (document.file_type !== "application/pdf") {
      throw new Error("Only PDF processing is implemented right now.");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error("File is too large. Maximum file size is 20 MB.");
    }

    const arrayBuffer = await file.arrayBuffer();

    const parser = new PDFParse({
      data: new Uint8Array(arrayBuffer),
    });

    let text: string;

    try {
      const result = await parser.getText();

      text = result.text.trim();
    } finally {
      await parser.destroy();
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
      console.error("Error deleting existing chunks:", deleteChunksError);

      throw new Error("Unable to reset existing document chunks.");
    }

    const { error: insertChunksError } = await supabase
      .from("document_chunks")
      .insert(chunkRows);

    if (insertChunksError) {
      console.error("Error inserting chunks:", insertChunksError);

      throw new Error("Unable to save document chunks.");
    }

    const { error: updateDocumentError } = await supabase
      .from("documents")
      .update({
        status: "processed",
      })
      .eq("id", document.id)
      .eq("user_id", user.id);

    if (updateDocumentError) {
      console.error("Error updating document status:", updateDocumentError);

      throw new Error(
        "Chunks were created, but document status could not be updated.",
      );
    }

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
    console.error("Error processing document:", error);

    /*
     * If anything fails after we marked the
     * document as processing, mark it as failed.
     */
    if (supabase && documentId && userId) {
      const { error: failedStatusError } = await supabase
        .from("documents")
        .update({
          status: "failed",
        })
        .eq("id", documentId)
        .eq("user_id", userId);

      if (failedStatusError) {
        console.error(
          "Error updating document status to failed:",
          failedStatusError,
        );
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
