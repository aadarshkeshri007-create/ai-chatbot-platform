"use client";

import Sidebar from "@/components/chat/Sidebar";
import ChatHeader from "@/components/chat/ChatHeader";
import { useSidebarContext } from "@/components/SidebarContext";

export default function AppShell({
    children,
}: {
    children: React.ReactNode;
}) {
    const {
        sidebarOpen,
        closeSidebar,
        toggleSidebar,
        conversations,
        activeConversationId,
        onSelectConversation,
        onNewChat,
        onDeleteConversation,
    } = useSidebarContext();

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar
                conversations={conversations}
                activeConversationId={
                    activeConversationId
                }
                onSelectConversation={
                    onSelectConversation
                }
                onNewChat={onNewChat}
                onDeleteConversation={
                    onDeleteConversation
                }
                isOpen={sidebarOpen}
                onClose={closeSidebar}
            />

            <main className="flex min-h-0 min-w-0 flex-1 flex-col">
                <ChatHeader
                    onToggleSidebar={
                        toggleSidebar
                    }
                />
                {children}
            </main>
        </div>
    );
}
