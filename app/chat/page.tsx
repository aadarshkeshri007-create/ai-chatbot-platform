"use client";

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

import type { Message } from "@/types/message";

import Sidebar from "@/components/chat/Sidebar";
import ChatHeader from "@/components/chat/ChatHeader";
import ChatMessages from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";

const BOTTOM_THRESHOLD_PX = 24;

type Conversation = {
    id: string;
    title: string;
    updated_at: string;
};

export default function ChatPage() {
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const [conversationId, setConversationId] = useState<string | null>(
        null,
    );

    const [conversations, setConversations] = useState<Conversation[]>([]);

    const messagesContainerRef = useRef<HTMLElement | null>(null);
    const shouldAutoScrollRef = useRef(true);

    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            role: "assistant",
            content: "Hello! How can I assist you today?",
        },
    ]);

    const scrollToBottom = useCallback(() => {
        const container = messagesContainerRef.current;

        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }, []);

    const handleMessagesScroll = useCallback(() => {
        const container = messagesContainerRef.current;

        if (!container) {
            return;
        }

        const distanceFromBottom =
            container.scrollHeight -
            container.scrollTop -
            container.clientHeight;

        shouldAutoScrollRef.current =
            distanceFromBottom <= BOTTOM_THRESHOLD_PX;
    }, []);

    useLayoutEffect(() => {
        if (shouldAutoScrollRef.current) {
            scrollToBottom();
        }
    }, [messages, scrollToBottom]);

    // Load the user's conversations
    useEffect(() => {
        const loadConversations = async () => {
            const supabase = createClient();

            const { data, error } = await supabase
                .from("conversations")
                .select("id, title, updated_at")
                .order("updated_at", { ascending: false });

            if (error) {
                console.error(
                    "Error loading conversations:",
                    error,
                );
                return;
            }

            setConversations(data ?? []);
        };

        loadConversations();
    }, []);

    // Start a new chat
    const handleNewChat = () => {
        setConversationId(null);

        setMessages([
            {
                id: "new-chat",
                role: "assistant",
                content: "Hello! How can I assist you today?",
            },
        ]);

        setMessage("");
        shouldAutoScrollRef.current = true;
    };

    const handleDeleteConversation = async (
    conversationIdToDelete: string,
) => {
    const supabase = createClient();

    const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationIdToDelete);

    if (error) {
        console.error(
            "Error deleting conversation:",
            error,
        );

        window.alert(
            "Unable to delete the conversation. Please try again.",
        );

        return;
    }

    setConversations((prevConversations) =>
        prevConversations.filter(
            (conversation) =>
                conversation.id !==
                conversationIdToDelete,
        ),
    );

    if (conversationId === conversationIdToDelete) {
        setConversationId(null);

        setMessages([
            {
                id: "new-chat",
                role: "assistant",
                content:
                    "Hello! How can I assist you today?",
            },
        ]);

        setMessage("");
        shouldAutoScrollRef.current = true;
    }
};

    // Load a conversation
    const handleSelectConversation = async (
        selectedConversationId: string,
    ) => {
        if (loading) {
            return;
        }

        setConversationId(selectedConversationId);
        setLoading(true);

        try {
            const supabase = createClient();

            const { data, error } = await supabase
                .from("messages")
                .select("id, role, content")
                .eq(
                    "conversation_id",
                    selectedConversationId,
                )
                .order("created_at", { ascending: true });

            if (error) {
                throw error;
            }

            setMessages(
                (data ?? []).map((msg) => ({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content,
                })),
            );

            shouldAutoScrollRef.current = true;
        } catch (error) {
            console.error(
                "Error loading conversation:",
                error,
            );

            setMessages([
                {
                    id: "error",
                    role: "assistant",
                    content:
                        "Unable to load this conversation.",
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const generateConversationTitle = (text: string) => {
        const cleanedText = text
            .replace(/\s+/g, " ")
            .trim();

        if (cleanedText.length <= 40) {
            return cleanedText;
        }

        return cleanedText.slice(0, 40).trimEnd() + "...";
    };

    const handleSendMessage = async () => {
        if (!message.trim() || loading) {
            return;
        }

        const userMessage = message;

        const assistantMessageId = crypto.randomUUID();

        shouldAutoScrollRef.current = true;

        setMessages((prevMessages) => [
            ...prevMessages,
            {
                id: crypto.randomUUID(),
                role: "user",
                content: userMessage,
            },
            {
                id: assistantMessageId,
                role: "assistant",
                content: "",
            },
        ]);

        setLoading(true);
        setMessage("");

        try {
            const response = await fetch("/api/chat", {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                },

                body: JSON.stringify({
                    message: userMessage,
                    conversationId,
                }),
            });

            if (!response.ok) {
                throw new Error(
                    "Failed to fetch AI response",
                );
            }

            const returnedConversationId =
                response.headers.get(
                    "X-Conversation-Id",
                );

            if (returnedConversationId) {
                setConversationId(
                    returnedConversationId,
                );
            }

            if (!conversationId && returnedConversationId) {
                const supabase = createClient();

                const title = generateConversationTitle(
                    userMessage,
                );

                const { error: titleError } = await supabase
                    .from("conversations")
                    .update({
                        title,
                    })
                    .eq("id", returnedConversationId);

                if (titleError) {
                    console.error(
                        "Error updating conversation title:",
                        titleError,
                    );
                }
            }

            const reader =
                response.body?.getReader();

            if (!reader) {
                throw new Error(
                    "Response body is missing",
                );
            }

            const decoder = new TextDecoder();

            let pendingContent = "";

            let updateFrame: number | null = null;

            const flushPendingContent = () => {
                updateFrame = null;

                if (!pendingContent) {
                    return;
                }

                const content = pendingContent;

                pendingContent = "";

                setMessages((prevMessages) =>
                    prevMessages.map((msg) =>
                        msg.id === assistantMessageId
                            ? {
                                ...msg,
                                content:
                                    msg.content +
                                    content,
                            }
                            : msg,
                    ),
                );
            };

            while (true) {
                const { done, value } =
                    await reader.read();

                if (done) {
                    break;
                }

                pendingContent += decoder.decode(
                    value,
                    { stream: true },
                );

                if (updateFrame === null) {
                    updateFrame =
                        requestAnimationFrame(
                            flushPendingContent,
                        );
                }
            }

            pendingContent += decoder.decode();

            if (updateFrame !== null) {
                cancelAnimationFrame(updateFrame);
            }

            flushPendingContent();

            // Refresh the conversation list
            const supabase = createClient();

            const { data } = await supabase
                .from("conversations")
                .select("id, title, updated_at")
                .order("updated_at", {
                    ascending: false,
                });

            setConversations(data ?? []);
        } catch (error) {
            console.error(error);

            setMessages((prevMessages) => [
                ...prevMessages,
                {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content:
                        "Something went wrong. Please try again.",
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar
                conversations={conversations}
                activeConversationId={conversationId}
                onSelectConversation={
                    handleSelectConversation
                }
                onNewChat={handleNewChat}
                onDeleteConversation={handleDeleteConversation}
            />

            <main className="flex min-h-0 flex-1 flex-col">
                <ChatHeader />

                <ChatMessages
                    messages={messages}
                    messagesContainerRef={
                        messagesContainerRef
                    }
                    onScroll={handleMessagesScroll}
                />

                <ChatInput
                    message={message}
                    setMessage={setMessage}
                    onSend={handleSendMessage}
                    loading={loading}
                />
            </main>
        </div>
    );
}