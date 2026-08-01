"use client";
import { useState } from "react";
import type { Message } from "@/types/message";
import Sidebar from "@/components/chat/Sidebar";
import ChatHeader from "@/components/chat/ChatHeader";
import ChatMessages from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";

export default function ChatPage() {
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            role: "assistant",
            content: "Hello! How can I assist you today?"
        }
    ]);
    const handleSendMessage = () => {
        if (!message.trim()) {
            return;
        }
        setMessages((prevMessages) => [
            ...prevMessages,
            {
                id: crypto.randomUUID(),
                role: "user",
                content: message
            }
        ]);
        setMessage("");
        setTimeout(() => {
            setMessages((prevMessages) => [
                ...prevMessages,
                {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: "This is a simulated response from the AI assistant."
                }
            ]);
        }, 1000);
    }
    return (
        <div className="flex min-h-screen bg-slate-50">
            <Sidebar />

            <main className="flex flex-1 flex-col">
                <ChatHeader />

                <ChatMessages messages={messages} />

                <ChatInput
                    message={message}
                    setMessage={setMessage}
                    onSend={handleSendMessage}
                />
            </main>
        </div>
    );
}