"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Conversation = {
    id: string;
    title: string;
    updated_at: string;
};

type SidebarProps = {
    conversations: Conversation[];
    activeConversationId: string | null;
    onSelectConversation: (conversationId: string) => void;
    onNewChat: () => void;
    onDeleteConversation: (conversationId: string) => void;
    isOpen: boolean;
    onClose: () => void;
};

/*
 * ── Navigation items ─────────────────────────────────
 */

const NAV_ITEMS: {
    label: string;
    href: string;
    icon: React.ReactNode;
}[] = [
    {
        label: "Chat",
        href: "/chat",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
        ),
    },
    {
        label: "History",
        href: "/history",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
            </svg>
        ),
    },
    {
        label: "Knowledge Base",
        href: "/upload",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
            </svg>
        ),
    },
    {
        label: "Settings",
        href: "/settings",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
        ),
    },
    {
        label: "Profile",
        href: "/profile",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
            </svg>
        ),
    },
];

export default function Sidebar({
    conversations,
    activeConversationId,
    onSelectConversation,
    onNewChat,
    onDeleteConversation,
    isOpen,
    onClose,
}: SidebarProps) {
    const pathname = usePathname();
    const isOnChatPage = pathname === "/chat";

    const handleDelete = (
        event: React.MouseEvent<HTMLButtonElement>,
        conversationId: string,
    ) => {
        event.stopPropagation();

        const confirmed = window.confirm(
            "Are you sure you want to delete this conversation? This cannot be undone.",
        );

        if (!confirmed) {
            return;
        }

        onDeleteConversation(conversationId);
    };

    const handleSelectConversation = (conversationId: string) => {
        onSelectConversation(conversationId);
        onClose();
    };

    const handleNewChat = () => {
        onNewChat();
        onClose();
    };

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            <aside
                className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-250 ease-out lg:relative lg:z-auto lg:translate-x-0 ${
                    isOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                {/* ── Brand ──────────────────────────────── */}
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <Link
                        href="/"
                        className="flex items-center gap-2.5 group"
                        onClick={onClose}
                    >
                        <div
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 transition-colors group-hover:bg-teal-700"
                            aria-hidden="true"
                        >
                            <span className="text-xs font-bold text-white">AI</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">
                            SupportAI
                        </span>
                    </Link>

                    {/* Close button — mobile only */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 lg:hidden"
                        aria-label="Close sidebar"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* ── Navigation ─────────────────────────── */}
                <nav className="px-3 pt-3 pb-1" aria-label="Main navigation">
                    <div className="flex flex-col gap-0.5">
                        {NAV_ITEMS.map((item) => {
                            const isActive = pathname === item.href;

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={onClose}
                                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
                                        isActive
                                            ? "bg-teal-50 text-teal-700 border-l-2 border-l-teal-500 shadow-sm"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                    }`}
                                    aria-current={isActive ? "page" : undefined}
                                >
                                    <span
                                        className={`flex-shrink-0 ${
                                            isActive
                                                ? "text-teal-600"
                                                : "text-slate-400"
                                        }`}
                                    >
                                        {item.icon}
                                    </span>
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                </nav>

                {/* ── Divider ────────────────────────────── */}
                <div className="mx-4 my-1 border-t border-slate-100" />

                {/* ── New Chat (always visible) ──────────── */}
                <div className="px-3 pt-2 pb-1">
                    <button
                        type="button"
                        onClick={handleNewChat}
                        className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all duration-150 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 active:scale-[0.98]"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        New chat
                    </button>
                </div>

                {/* ── Conversations (only on /chat) ──────── */}
                {isOnChatPage && (
                    <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 pt-3 pb-2" aria-label="Conversations">
                        {conversations.length === 0 ? (
                            <div className="flex flex-col items-center py-8 text-center">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 mb-2" aria-hidden="true">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                <p className="text-xs text-slate-400">
                                    No conversations yet
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-0.5">
                                <span className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                                    Recent
                                </span>
                                {conversations.map((conversation) => {
                                    const isActive = activeConversationId === conversation.id;
                                    return (
                                        <div
                                            key={conversation.id}
                                            className={`group flex items-center gap-1 rounded-lg transition-colors duration-100 ${
                                                isActive
                                                    ? "bg-teal-50 border-l-2 border-l-teal-500"
                                                    : "hover:bg-slate-50"
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleSelectConversation(conversation.id)
                                                }
                                                className={`min-w-0 flex-1 truncate px-3 py-2 text-left text-[13px] transition-colors ${
                                                    isActive
                                                        ? "font-medium text-teal-800"
                                                        : "text-slate-600 hover:text-slate-900"
                                                }`}
                                                title={conversation.title}
                                            >
                                                {conversation.title}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={(event) =>
                                                    handleDelete(event, conversation.id)
                                                }
                                                aria-label={`Delete ${conversation.title}`}
                                                className="mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-0 transition-all duration-100 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <line x1="18" y1="6" x2="6" y2="18" />
                                                    <line x1="6" y1="6" x2="18" y2="18" />
                                                </svg>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </nav>
                )}

                {/* Spacer when not on chat page */}
                {!isOnChatPage && <div className="flex-1" />}

            </aside>
        </>
    );
}