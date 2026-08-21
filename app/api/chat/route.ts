import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
    try {
        const { message, conversationId } = await request.json();

        if (!message || typeof message !== "string") {
            return NextResponse.json(
                { error: "Message is required." },
                { status: 400 },
            );
        }

        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: "Unauthorized." },
                { status: 401 },
            );
        }

        let activeConversationId = conversationId;

        if (activeConversationId) {
            const { data: conversation, error: conversationError } =
                await supabase
                    .from("conversations")
                    .select("id")
                    .eq("id", activeConversationId)
                    .single();

            if (conversationError || !conversation) {
                return NextResponse.json(
                    { error: "Conversation not found." },
                    { status: 404 },
                );
            }
        } else {
            const { data: conversation, error: conversationError } =
                await supabase
                    .from("conversations")
                    .insert({
                        user_id: user.id,
                    })
                    .select("id")
                    .single();

            if (conversationError || !conversation) {
                console.error(
                    "Error creating conversation:",
                    conversationError,
                );

                return NextResponse.json(
                    { error: "Failed to create conversation." },
                    { status: 500 },
                );
            }

            activeConversationId = conversation.id;
        }
 
        const { error: userMessageError } = await supabase
            .from("messages")
            .insert({
                conversation_id: activeConversationId,
                role: "user",
                content: message,
            });

        if (userMessageError) {
            console.error(
                "Error saving user message:",
                userMessageError,
            );

            return NextResponse.json(
                { error: "Failed to save message." },
                { status: 500 },
            );
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not set");
        }
        
        const ai = new GoogleGenAI({
            apiKey,
            httpOptions: { timeout: 30_000 },
        });

        const { data: conversationMessages, error: historyError } =
            await supabase
                .from("messages")
                .select("role, content")
                .eq("conversation_id", activeConversationId)
                .order("created_at", { ascending: true });

        if (historyError) {
            console.error(
                "Error loading conversation history:",
                historyError,
            );

            return NextResponse.json(
                { error: "Failed to load conversation history." },
                { status: 500 },
            );
        }

        const contents = conversationMessages.map((msg) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [
                {
                    text: msg.content,
                },
            ],
        }));

        const result = await ai.models.generateContentStream({
            model: "gemini-3.5-flash-lite",
            contents,
        });
        const encoder = new TextEncoder();

        let assistantResponse = "";

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of result) {
                        const text = chunk.text ?? "";

                        assistantResponse += text;

                        controller.enqueue(
                            encoder.encode(text),
                        );
                    }

                    // 7. Save the complete assistant response
                    if (assistantResponse) {
                        const { error: assistantMessageError } =
                            await supabase
                                .from("messages")
                                .insert({
                                    conversation_id:
                                        activeConversationId,
                                    role: "assistant",
                                    content: assistantResponse,
                                });

                        if (assistantMessageError) {
                            console.error(
                                "Error saving assistant message:",
                                assistantMessageError,
                            );
                        }
                    }

                    // 8. Update conversation activity
                    const { error: updateError } = await supabase
                        .from("conversations")
                        .update({
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", activeConversationId);

                    if (updateError) {
                        console.error(
                            "Error updating conversation:",
                            updateError,
                        );
                    }

                    controller.close();
                } catch (error) {
                    console.error(
                        "Error reading from result stream:",
                        error,
                    );

                    controller.error(error);
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "X-Conversation-Id": activeConversationId,
            },
        });
    } catch (error) {
        console.error("Error generating content:", error);

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