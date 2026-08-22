import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

        const { query, documentId } = body;

        if (!query || typeof query !== "string") {
            return NextResponse.json(
                { error: "Query is required." },
                { status: 400 },
            );
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error(
                "GEMINI_API_KEY is not set",
            );
        }

        const ai = new GoogleGenAI({
            apiKey,
        });

        const embeddingResponse =
            await ai.models.embedContent({
                model: "gemini-embedding-001",
                contents: query,
                config: {
                    taskType: "RETRIEVAL_QUERY",
                    outputDimensionality: 768,
                },
            });

        const queryEmbedding =
            embeddingResponse.embeddings?.[0]?.values;

        if (
            !queryEmbedding ||
            queryEmbedding.length !== 768
        ) {
            throw new Error(
                "Failed to generate query embedding.",
            );
        }

        const { data: chunks, error: searchError } =
            await supabase.rpc(
                "match_document_chunks",
                {
                    query_embedding:
                        queryEmbedding,
                    match_count: 5,
                    filter_user_id: user.id,
                },
            );

        if (searchError) {
            console.error(
                "Vector search error:",
                searchError,
            );

            return NextResponse.json(
                {
                    error:
                        "Failed to search document chunks.",
                },
                { status: 500 },
            );
        }

        const filteredChunks =
            documentId
                ? chunks?.filter(
                      (chunk: {
                          document_id: string;
                      }) =>
                          chunk.document_id ===
                          documentId,
                  )
                : chunks;

        return NextResponse.json({
            success: true,
            query,
            results: filteredChunks ?? [],
        });
    } catch (error) {
        console.error(
            "Error searching documents:",
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