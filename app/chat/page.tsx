"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Message } from "@/types/message";
import Sidebar from "@/components/chat/Sidebar";
import ChatHeader from "@/components/chat/ChatHeader";
import ChatMessages from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";

const BOTTOM_THRESHOLD_PX = 24;

export default function ChatPage() {
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesContainerRef = useRef<HTMLElement | null>(null);
    const shouldAutoScrollRef = useRef(true);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            role: "assistant",
            content: "Hello! How can I assist you today?"
        }
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
            container.scrollHeight - container.scrollTop - container.clientHeight;

        shouldAutoScrollRef.current = distanceFromBottom <= BOTTOM_THRESHOLD_PX;
    }, []);

    useLayoutEffect(() => {
        if (shouldAutoScrollRef.current) {
            scrollToBottom();
        }
    }, [messages, scrollToBottom]);

    const handleSendMessage = async () => {
        if (!message.trim()) {
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
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to fetch AI response");
            }

            const reader = response.body?.getReader();

            if (!reader) {
                throw new Error("Response body is missing");
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
                            ? { ...msg, content: msg.content + content }
                            : msg
                    )
                );
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                pendingContent += decoder.decode(value, { stream: true });

                if (updateFrame === null) {
                    updateFrame = requestAnimationFrame(flushPendingContent);
                }
            }

            pendingContent += decoder.decode();

            if (updateFrame !== null) {
                cancelAnimationFrame(updateFrame);
            }

            flushPendingContent();
        }
        catch (error) {
            console.error(error);

            setMessages((prevMessages) => [
                ...prevMessages,
                {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: "Something went wrong. Please try again.",
                },
            ]);
        }
        finally {
            setLoading(false);
        }
    }
    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar />

            <main className="flex min-h-0 flex-1 flex-col">
                <ChatHeader />

                <ChatMessages
                    messages={messages}
                    messagesContainerRef={messagesContainerRef}
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
