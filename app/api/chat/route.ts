import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

const MATCH_COUNT = 5;
const MATCH_THRESHOLD = 0.60;

const generateConversationTitle = (
    text: string,
) => {
    const cleanedText = text
        .replace(/\s+/g, " ")
        .trim();

    if (cleanedText.length <= 40) {
        return cleanedText || "New conversation";
    }

    return (
        cleanedText.slice(0, 40).trimEnd() +
        "..."
    );
};

export async function POST(request: Request) {
    try {
        const supabase = await createClient();

        /*
         * ------------------------------------------------
         * 1. Authenticate user
         * ------------------------------------------------
         */

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json(
                {
                    error: "Unauthorized",
                },
                {
                    status: 401,
                },
            );
        }

        /*
         * ------------------------------------------------
         * 2. Read request
         * ------------------------------------------------
         */

        const {
            message,
            conversationId,
        } = await request.json();

        if (
            !message ||
            typeof message !== "string"
        ) {
            return NextResponse.json(
                {
                    error:
                        "Message is required.",
                },
                {
                    status: 400,
                },
            );
        }

        const cleanMessage =
            message.trim();

        if (!cleanMessage) {
            return NextResponse.json(
                {
                    error:
                        "Message is required.",
                },
                {
                    status: 400,
                },
            );
        }

        /*
         * ------------------------------------------------
         * 3. Get Gemini client
         * ------------------------------------------------
         */

        const apiKey =
            process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error(
                "GEMINI_API_KEY is not set",
            );
        }

        const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
                timeout: 30_000,
            },
        });

        /*
         * ------------------------------------------------
         * 4. Create or verify conversation
         * ------------------------------------------------
         */

        let activeConversationId =
            conversationId as
                | string
                | null;

        if (!activeConversationId) {
            const title =
                generateConversationTitle(
                    cleanMessage,
                );

            const {
                data: newConversation,
                error: conversationError,
            } = await supabase
                .from("conversations")
                .insert({
                    user_id: user.id,
                    title,
                })
                .select(
                    "id, title, updated_at",
                )
                .single();

            if (conversationError) {
                console.error(
                    "Conversation creation error:",
                    conversationError,
                );

                throw new Error(
                    "Failed to create conversation.",
                );
            }

            activeConversationId =
                newConversation.id;
        } else {
            /*
             * Make sure the conversation belongs
             * to the authenticated user.
             */

            const {
                data: conversation,
                error: conversationError,
            } = await supabase
                .from("conversations")
                .select("id")
                .eq(
                    "id",
                    activeConversationId,
                )
                .eq(
                    "user_id",
                    user.id,
                )
                .single();

            if (
                conversationError ||
                !conversation
            ) {
                return NextResponse.json(
                    {
                        error:
                            "Conversation not found.",
                    },
                    {
                        status: 404,
                    },
                );
            }
        }

        /*
         * ------------------------------------------------
         * 5. Save user message
         * ------------------------------------------------
         */

        const {
            error: userMessageError,
        } = await supabase
            .from("messages")
            .insert({
                conversation_id:
                    activeConversationId,
                role: "user",
                content: cleanMessage,
            });

        if (userMessageError) {
            console.error(
                "User message save error:",
                userMessageError,
            );

            throw new Error(
                "Failed to save user message.",
            );
        }

        /*
         * ------------------------------------------------
         * 6. Generate query embedding
         * ------------------------------------------------
         */

        const embeddingResponse =
            await ai.models.embedContent({
                model: EMBEDDING_MODEL,
                contents: cleanMessage,
                config: {
                    taskType:
                        "RETRIEVAL_QUERY",
                    outputDimensionality:
                        EMBEDDING_DIMENSIONS,
                },
            });

        const queryEmbedding =
            embeddingResponse.embeddings?.[0]
                ?.values;

        if (
            !queryEmbedding ||
            queryEmbedding.length !==
                EMBEDDING_DIMENSIONS
        ) {
            throw new Error(
                "Failed to generate query embedding.",
            );
        }

        /*
         * ------------------------------------------------
         * 7. Search knowledge base
         * ------------------------------------------------
         */

        const {
            data: chunks,
            error: searchError,
        } = await supabase.rpc(
            "match_document_chunks",
            {
                query_embedding:
                    queryEmbedding,
                match_count:
                    MATCH_COUNT,
                filter_user_id:
                    user.id,
                match_threshold:
                    MATCH_THRESHOLD,
            },
        );

        if (searchError) {
            console.error(
                "Vector search error:",
                searchError,
            );

            throw new Error(
                "Failed to search knowledge base.",
            );
        }

        const relevantChunks =
            chunks ?? [];

        /*
         * ------------------------------------------------
         * 8. Build RAG context
         * ------------------------------------------------
         */

        const context =
            relevantChunks.length > 0
                ? relevantChunks
                      .map(
                          (
                              chunk: {
                                  file_name: string;
                                  content: string;
                              },
                              index: number,
                          ) =>
                              `Source ${
                                  index + 1
                              }: ${
                                  chunk.file_name
                              }\n${
                                  chunk.content
                              }`,
                      )
                      .join("\n\n")
                : "";

        /*
         * ------------------------------------------------
         * 9. Build unique source list
         * ------------------------------------------------
         */

        const sources = Array.from(
            new Map(
                relevantChunks.map(
                    (chunk: {
                        document_id: string;
                        file_name: string;
                    }) => [
                        chunk.document_id,
                        {
                            documentId:
                                chunk.document_id,
                            fileName:
                                chunk.file_name,
                        },
                    ],
                ),
            ).values(),
        );

        console.log(
            "RAG SOURCES:",
            sources,
        );

        /*
         * ------------------------------------------------
         * 10. Build system instruction
         * ------------------------------------------------
         */

        const systemInstruction = `
You are an AI customer support assistant.

You have access to a knowledge base containing
documents uploaded by the user.

Use the knowledge base only when it is relevant
to the user's question.

IMPORTANT RULES:

1. Do not force knowledge base information into
   unrelated questions.

2. Do not invent business-specific information.

3. If a business-specific question cannot be
   answered from the knowledge base, clearly say
   that you don't have enough information.

4. You may use general knowledge for normal
   general-purpose questions.

5. Keep answers concise and natural.

Knowledge Base Context:

${
    context ||
    "No sufficiently relevant knowledge base information was found."
}
`;

        /*
         * ------------------------------------------------
         * 11. Generate streaming response
         * ------------------------------------------------
         */

        const result =
            await ai.models.generateContentStream({
                model: "gemini-3.5-flash-lite",
                contents: cleanMessage,
                config: {
                    systemInstruction,
                },
            });

        /*
         * ------------------------------------------------
         * 12. Stream response and save assistant message
         * ------------------------------------------------
         */

        const encoder =
            new TextEncoder();

        let fullAssistantResponse = "";

        const stream =
            new ReadableStream({
                async start(controller) {
                    try {
                        for await (
                            const chunk of result
                        ) {
                            const text =
                                chunk.text ??
                                "";

                            if (text) {
                                fullAssistantResponse +=
                                    text;

                                controller.enqueue(
                                    encoder.encode(
                                        text,
                                    ),
                                );
                            }
                        }

                        /*
                         * Save the complete assistant
                         * response after streaming finishes.
                         */

                        if (
                            activeConversationId
                        ) {
                            const {
                                error:
                                    assistantMessageError,
                            } =
                                await supabase
                                    .from(
                                        "messages",
                                    )
                                    .insert({
                                        conversation_id:
                                            activeConversationId,
                                        role: "assistant",
                                        content:
                                            fullAssistantResponse,
                                    });

                            if (
                                assistantMessageError
                            ) {
                                console.error(
                                    "Assistant message save error:",
                                    assistantMessageError,
                                );
                            }

                            /*
                             * Update conversation timestamp.
                             */

                            const {
                                error:
                                    updateError,
                            } =
                                await supabase
                                    .from(
                                        "conversations",
                                    )
                                    .update({
                                        updated_at:
                                            new Date().toISOString(),
                                    })
                                    .eq(
                                        "id",
                                        activeConversationId,
                                    )
                                    .eq(
                                        "user_id",
                                        user.id,
                                    );

                            if (updateError) {
                                console.error(
                                    "Conversation update error:",
                                    updateError,
                                );
                            }
                        }

                        controller.close();
                    } catch (error) {
                        console.error(
                            "Error reading result stream:",
                            error,
                        );

                        controller.error(
                            error,
                        );
                    }
                },
            });

        /*
         * ------------------------------------------------
         * 13. Build response headers
         * ------------------------------------------------
         */

        const headers =
            new Headers();

        headers.set(
            "Content-Type",
            "text/plain; charset=utf-8",
        );

        headers.set(
            "X-Conversation-Id",
            activeConversationId!,
        );

        headers.set(
            "X-Chat-Sources",
            JSON.stringify(sources),
        );

        /*
         * ------------------------------------------------
         * 14. Return streaming response
         * ------------------------------------------------
         */

        return new Response(stream, {
            status: 200,
            headers,
        });
    } catch (error) {
        console.error(
            "Error generating content:",
            error,
        );

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unknown error",
            },
            {
                status: 500,
            },
        );
    }
}