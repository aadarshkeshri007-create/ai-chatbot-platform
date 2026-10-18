"use client";

import { useEffect } from "react";
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
        collapsed,
        toggleCollapsed,
        conversations,
        activeConversationId,
        onSelectConversation,
        onNewChat,
        onDeleteConversation,
    } = useSidebarContext();

    useEffect(() => {
        const viewport = window.visualViewport;

        const updateViewportHeight = () => {
            const measuredHeight = viewport?.height ?? window.innerHeight;
            const height = Number.isFinite(measuredHeight) && measuredHeight > 0
                ? measuredHeight
                : window.innerHeight;

            if (!Number.isFinite(height) || height <= 0) {
                return;
            }

            document.documentElement.style.setProperty(
                "--app-viewport-height",
                `${Math.max(1, Math.round(height))}px`,
            );
        };

        updateViewportHeight();
        window.addEventListener("resize", updateViewportHeight);
        viewport?.addEventListener("resize", updateViewportHeight);

        return () => {
            window.removeEventListener("resize", updateViewportHeight);
            viewport?.removeEventListener("resize", updateViewportHeight);
            document.documentElement.style.removeProperty("--app-viewport-height");
        };
    }, []);

    return (
        <div className="app-viewport flex w-full max-w-full overflow-clip bg-[var(--background)]">
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
                collapsed={collapsed}
                onToggleCollapsed={toggleCollapsed}
            />

            <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--background)] transition-all duration-300">
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
