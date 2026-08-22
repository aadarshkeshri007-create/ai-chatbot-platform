import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getPath } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

function createChunks(text: string) {
    const chunks: string[] = [];

    let start = 0;

    while (start < text.length) {
        const end = Math.min(
            start + CHUNK_SIZE,
            text.length,
        );

        const chunk = text
            .slice(start, end)
            .trim();

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
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const body = await request.json();
        const { documentId } = body;

        if (
            !documentId ||
            typeof documentId !== "string"
        ) {
            return NextResponse.json(
                {
                    error:
                        "Document ID is required.",
                },
                { status: 400 },
            );
        }

        const { data: document, error: documentError } =
            await supabase
                .from("documents")
                .select(
                    "id, user_id, file_name, file_path, file_type, file_size, status",
                )
                .eq("id", documentId)
                .eq("user_id", user.id)
                .single();

        if (documentError || !document) {
            return NextResponse.json(
                {
                    error:
                        "Document not found.",
                },
                { status: 404 },
            );
        }

        const { data: file, error: downloadError } =
            await supabase.storage
                .from("knowledge-base")
                .download(document.file_path);

        if (downloadError || !file) {
            console.error(
                "Error downloading document:",
                downloadError,
            );

            return NextResponse.json(
                {
                    error:
                        "Unable to download document.",
                },
                { status: 500 },
            );
        }

        if (
            document.file_type !==
            "application/pdf"
        ) {
            return NextResponse.json(
                {
                    error:
                        "Only PDF processing is implemented right now.",
                },
                { status: 400 },
            );
        }

        const arrayBuffer =
            await file.arrayBuffer();

        const parser = new PDFParse({
            data: new Uint8Array(
                arrayBuffer,
            ),
        });

        let text: string;

        try {
            const result =
                await parser.getText();

            text = result.text.trim();
        } finally {
            await parser.destroy();
        }

        if (!text) {
            return NextResponse.json(
                {
                    error:
                        "No extractable text was found in this PDF.",
                },
                { status: 422 },
            );
        }

        const chunks = createChunks(text);

        if (chunks.length === 0) {
            return NextResponse.json(
                {
                    error:
                        "No chunks could be created from this document.",
                },
                { status: 422 },
            );
        }

        const apiKey =
            process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error(
                "GEMINI_API_KEY is not set",
            );
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
        const embeddingResponse =
            await ai.models.embedContent({
                model: EMBEDDING_MODEL,
                contents: chunks,
                config: {
                    taskType:
                        "RETRIEVAL_DOCUMENT",
                    outputDimensionality:
                        EMBEDDING_DIMENSIONS,
                },
            });

        const embeddings =
            embeddingResponse.embeddings;

        if (
            !embeddings ||
            embeddings.length !== chunks.length
        ) {
            throw new Error(
                "Embedding count does not match chunk count.",
            );
        }

        const chunkRows = chunks.map(
            (content, index) => {
                const embedding =
                    embeddings[index]?.values;

                if (
                    !embedding ||
                    embedding.length !==
                        EMBEDDING_DIMENSIONS
                ) {
                    throw new Error(
                        `Invalid embedding for chunk ${index}.`,
                    );
                }

                return {
                    document_id:
                        document.id,
                    user_id: user.id,
                    content,
                    chunk_index: index,
                    embedding,
                };
            },
        );

        /*
         * Delete existing chunks so that
         * reprocessing the same document does
         * not create duplicates.
         */
        const {
            error: deleteChunksError,
        } = await supabase
            .from("document_chunks")
            .delete()
            .eq("document_id", document.id)
            .eq("user_id", user.id);

        if (deleteChunksError) {
            console.error(
                "Error deleting existing chunks:",
                deleteChunksError,
            );

            return NextResponse.json(
                {
                    error:
                        "Unable to reset existing document chunks.",
                },
                { status: 500 },
            );
        }

        const {
            error: insertChunksError,
        } = await supabase
            .from("document_chunks")
            .insert(chunkRows);

        if (insertChunksError) {
            console.error(
                "Error inserting chunks:",
                insertChunksError,
            );

            return NextResponse.json(
                {
                    error:
                        "Unable to save document chunks.",
                },
                { status: 500 },
            );
        }

        const {
            error: updateDocumentError,
        } = await supabase
            .from("documents")
            .update({
                status: "processed",
            })
            .eq("id", document.id)
            .eq("user_id", user.id);

        if (updateDocumentError) {
            console.error(
                "Error updating document status:",
                updateDocumentError,
            );

            return NextResponse.json(
                {
                    error:
                        "Chunks were created, but document status could not be updated.",
                },
                { status: 500 },
            );
        }

        return NextResponse.json({
            success: true,
            message:
                "Document processed and embedded successfully.",
            document: {
                id: document.id,
                fileName: document.file_name,
                fileType: document.file_type,
            },
            extractedCharacters:
                text.length,
            chunkCount:
                chunks.length,
            embeddingDimensions:
                EMBEDDING_DIMENSIONS,
        });
    } catch (error) {
        console.error(
            "Error processing document:",
            error,
        );

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unknown error",
            },
            { status: 500 },
        );
    }
}