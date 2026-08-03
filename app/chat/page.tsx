"use client";
import { useState, useRef, useEffect } from "react";
import type { Message } from "@/types/message";
import Sidebar from "@/components/chat/Sidebar";
import ChatHeader from "@/components/chat/ChatHeader";
import ChatMessages from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";

export default function ChatPage() {
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesContainerRef = useRef<HTMLElement | null>(null);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            role: "assistant",
            content: "Hello! How can I assist you today?"
        }
    ]);
    useEffect(() => {
        messagesContainerRef.current?.scrollTo({
            top: messagesContainerRef.current.scrollHeight,
            behavior: "smooth",
        });
    }, [messages]);
    const handleSendMessage = async () => {
        if (!message.trim()) {
            return;
        }

        const userMessage = message;

        setMessages((prevMessages) => [
            ...prevMessages,
            {
                id: crypto.randomUUID(),
                role: "user",
                content: userMessage,
            },
        ]);

        setMessage("");
        setLoading(true);
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

            const data = await response.json();

            setMessages((prevMessages) => [
                ...prevMessages,
                {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: data.response,
                },
            ]);
        } catch (error) {
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
    };
    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar />

            <main className="flex min-h-0 flex-1 flex-col">
                <ChatHeader />

                <ChatMessages
                    messages={messages} messagesContainerRef={messagesContainerRef} />

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