"use client";

import { useEffect, useRef } from "react";
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
    collapsed?: boolean;
    onToggleCollapsed?: () => void;
};

/*
 * â”€â”€ Navigation items â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 */

const MAIN_NAV_ITEMS: {
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
        label: "Chat History",
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
        label: "Support Inbox",
        href: "/handoffs",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h16v12H4z" />
                <path d="m4 6 8 6 8-6" />
                <path d="M8 20h8" />
            </svg>
        ),
    },
];

const BOTTOM_NAV_ITEMS: {
    label: string;
    href: string;
    icon: React.ReactNode;
}[] = [
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
    {
        label: "Install Widget",
        href: "/install",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M7 8h10M7 12h5M7 16h3" />
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
    collapsed = false,
    onToggleCollapsed,
}: SidebarProps) {
    const pathname = usePathname();
    const isOnChatPage = pathname === "/chat";
    const sidebarRef = useRef<HTMLElement>(null);

    /* Close on Escape key */
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

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
                    className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden dark:bg-black/60"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            <aside
                ref={sidebarRef}
                role={isOpen ? "dialog" : undefined}
                aria-modal={isOpen ? "true" : undefined}
                aria-label="Navigation"
                className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-300 ease-in-out lg:relative lg:z-auto lg:translate-x-0 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] ${
                    isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
                } ${
                    collapsed ? "w-72 max-w-[calc(100vw-3rem)] lg:max-w-none lg:w-16" : "w-72 max-w-[calc(100vw-3rem)] lg:max-w-none"
                }`}
            >
                {/* â”€â”€ Header: Brand & Collapse Toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                <div className={`flex items-center justify-between pt-4 pb-2 ${collapsed ? "px-3 lg:px-2 lg:justify-center" : "px-4"}`}>
                    {/* Brand */}
                    <Link
                        href="/chat"
                        className={`flex items-center group/brand ${collapsed ? "gap-0 lg:justify-center" : "gap-2.5"}`}
                        onClick={onClose}
                        title={collapsed ? "SupportAI â€” Go to home" : undefined}
                        aria-label="SupportAI Home"
                    >
                        <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] transition-colors group-hover/brand:brightness-95 shadow-sm"
                            aria-hidden="true"
                        >
                            <span className="text-xs font-bold text-white">AI</span>
                        </div>
                        <span className={`text-sm font-semibold text-[var(--text-primary)] transition-opacity duration-200 ${collapsed ? "lg:hidden" : "block"}`}>
                            SupportAI
                        </span>
                    </Link>

                    {/* Desktop collapse button (visible when expanded) */}
                    <button
                        type="button"
                        onClick={onToggleCollapsed}
                        className={`hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                            collapsed ? "lg:hidden" : ""
                        }`}
                        aria-label="Collapse sidebar"
                        title="Collapse sidebar"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="9" y1="3" x2="9" y2="21" />
                            <polyline points="17 9 14 12 17 15" />
                        </svg>
                    </button>

                    {/* Mobile close button â€” 44px min touch target */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        aria-label="Close sidebar"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* â”€â”€ Desktop Expand Toggle (visible only when collapsed on desktop) â”€â”€ */}
                {collapsed && (
                    <div className="hidden lg:flex justify-center px-2 pt-1 pb-1">
                        <button
                            type="button"
                            onClick={onToggleCollapsed}
                            className="group/expand relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                            aria-label="Expand sidebar"
                            title="Expand sidebar"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <line x1="9" y1="3" x2="9" y2="21" />
                                <polyline points="14 9 17 12 14 15" />
                            </svg>
                            <span className="pointer-events-none absolute left-full ml-2 z-50 hidden rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-md group-hover/expand:block dark:bg-slate-800 dark:border dark:border-slate-700 whitespace-nowrap" role="tooltip">
                                Expand sidebar
                            </span>
                        </button>
                    </div>
                )}

                {/* â”€â”€ New Chat button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                <div className={`pt-2 pb-1 ${collapsed ? "px-3 lg:px-2" : "px-3"}`}>
                    <button
                        type="button"
                        onClick={handleNewChat}
                        title={collapsed ? "New chat" : undefined}
                        aria-label="New chat"
                        className={`group/newchat relative flex w-full items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm font-semibold text-[var(--text-primary)] shadow-sm transition-all duration-150 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] focus-visible:outline-none active:scale-[0.98] ${
                            collapsed
                                ? "justify-center px-0 py-2.5 lg:justify-center"
                                : "gap-2 px-3 py-2.5"
                        }`}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span className={collapsed ? "lg:hidden" : ""}>
                            New chat
                        </span>
                        {collapsed && (
                            <span className="pointer-events-none absolute left-full ml-2 z-50 hidden rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-md group-hover/newchat:block dark:bg-slate-800 dark:border dark:border-slate-700 whitespace-nowrap" role="tooltip">
                                New chat
                            </span>
                        )}
                    </button>
                </div>

                {/* â”€â”€ Main Navigation Links â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                <nav className={`pt-2 pb-1 ${collapsed ? "px-3 lg:px-2" : "px-3"}`} aria-label="Main navigation">
                    <div className="flex flex-col gap-0.5">
                        {MAIN_NAV_ITEMS.map((item) => {
                            const isActive = pathname === item.href;

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={onClose}
                                    title={collapsed ? item.label : undefined}
                                    aria-label={collapsed ? item.label : undefined}
                                    className={`group/navitem relative flex items-center rounded-lg text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
                                        collapsed
                                            ? "justify-center px-0 py-2.5"
                                            : "gap-2.5 px-3 py-2"
                                    } ${
                                        isActive
                                            ? "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 shadow-sm"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
                                    }`}
                                    aria-current={isActive ? "page" : undefined}
                                >
                                    {/* Active border bar */}
                                    {isActive && (
                                        <span
                                            className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-teal-500"
                                            aria-hidden="true"
                                        />
                                    )}

                                    <span
                                        className={`shrink-0 ${
                                            isActive
                                                ? "text-teal-600 dark:text-teal-400"
                                                : "text-slate-400 group-hover/navitem:text-slate-600 dark:text-slate-400 dark:group-hover/navitem:text-slate-200"
                                        }`}
                                    >
                                        {item.icon}
                                    </span>

                                    <span className={collapsed ? "lg:hidden" : ""}>
                                        {item.label}
                                    </span>

                                    {/* Tooltip on collapsed desktop hover */}
                                    {collapsed && (
                                        <span className="pointer-events-none absolute left-full ml-2 z-50 hidden rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-md group-hover/navitem:block dark:bg-slate-800 dark:border dark:border-slate-700 whitespace-nowrap" role="tooltip">
                                            {item.label}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </nav>

                {/* â”€â”€ Divider â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                <div className={`my-1 border-t border-slate-100 dark:border-slate-800 ${collapsed ? "mx-3 lg:mx-2" : "mx-4"}`} />

                {/* â”€â”€ Conversations list (only on /chat, hidden when collapsed on desktop) â”€â”€ */}
                {isOnChatPage && (
                    <nav
                        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin px-3 pt-2 pb-2 ${
                            collapsed ? "lg:hidden" : ""
                        }`}
                        aria-label="Conversations"
                    >
                        {conversations.length === 0 ? (
                            <div className="flex flex-col items-center py-8 text-center">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 dark:text-slate-600 mb-2" aria-hidden="true">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                    No conversations yet
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-0.5">
                                <span className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    Recent
                                </span>
                                {conversations.map((conversation) => {
                                    const isActive = activeConversationId === conversation.id;
                                    return (
                                        <div
                                            key={conversation.id}
                                            className={`group flex items-center gap-1 rounded-lg transition-colors duration-100 ${
                                                isActive
                                                    ? "bg-teal-50 border-l-2 border-l-teal-500 dark:bg-teal-950/40 dark:border-l-teal-400"
                                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleSelectConversation(conversation.id)
                                                }
                                                className={`min-w-0 flex-1 truncate px-3 py-2 text-left text-[13px] transition-colors ${
                                                    isActive
                                                        ? "font-medium text-teal-800 dark:text-teal-300"
                                                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
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
                                                className="mr-1.5 flex h-7 w-7 min-h-[44px] min-w-[44px] sm:h-6 sm:w-6 sm:min-h-0 sm:min-w-0 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-100 sm:opacity-0 transition-all duration-100 hover:bg-red-50 hover:text-red-500 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400 group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
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

                {/* Spacer when not on /chat or collapsed */}
                {(!isOnChatPage || collapsed) && <div className="flex-1" />}

                {/* â”€â”€ Bottom Section: Settings and Profile â”€â”€ */}
                <div className={`border-t border-slate-100 dark:border-slate-800 pt-2 pb-3 ${collapsed ? "px-3 lg:px-2" : "px-3"}`}>
                    <div className="flex flex-col gap-0.5">
                        {/* Settings & Profile */}
                        {BOTTOM_NAV_ITEMS.map((item) => {
                            const isActive = pathname === item.href;

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={onClose}
                                    title={collapsed ? item.label : undefined}
                                    aria-label={collapsed ? item.label : undefined}
                                    className={`group/botitem relative flex items-center rounded-lg text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
                                        collapsed
                                            ? "justify-center px-0 py-2.5"
                                            : "gap-2.5 px-3 py-2"
                                    } ${
                                        isActive
                                            ? "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 shadow-sm"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
                                    }`}
                                    aria-current={isActive ? "page" : undefined}
                                >
                                    {isActive && (
                                        <span
                                            className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-teal-500"
                                            aria-hidden="true"
                                        />
                                    )}

                                    <span
                                        className={`shrink-0 ${
                                            isActive
                                                ? "text-teal-600 dark:text-teal-400"
                                                : "text-slate-400 group-hover/botitem:text-slate-600 dark:text-slate-400 dark:group-hover/botitem:text-slate-200"
                                        }`}
                                    >
                                        {item.icon}
                                    </span>

                                    <span className={collapsed ? "lg:hidden" : ""}>
                                        {item.label}
                                    </span>

                                    {collapsed && (
                                        <span className="pointer-events-none absolute left-full ml-2 z-50 hidden rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-md group-hover/botitem:block dark:bg-slate-800 dark:border dark:border-slate-700 whitespace-nowrap" role="tooltip">
                                            {item.label}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </aside>
        </>
    );
}
