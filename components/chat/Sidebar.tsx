"use client";

import Link from "next/link";

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
};

export default function Sidebar({
    conversations,
    activeConversationId,
    onSelectConversation,
    onNewChat,
    onDeleteConversation,
}: SidebarProps) {
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

    return (
        <aside className="flex w-64 flex-col gap-6 border-r border-slate-200 bg-white p-4">
            <div className="px-2 pt-1">
                <h2 className="text-base font-semibold tracking-tight text-slate-900">
                    AI Customer Support
                </h2>
            </div>

            <nav className="flex flex-col gap-1.5">
                <button
                    type="button"
                    onClick={onNewChat}
                    className="rounded-lg bg-teal-600 px-3 py-2.5 text-left text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                    + New Chat
                </button>

                <div className="mt-3 flex flex-col gap-1">
                    {conversations.map((conversation) => (
                        <div
                            key={conversation.id}
                            className={`group flex items-center gap-1 rounded-lg ${
                                activeConversationId === conversation.id
                                    ? "bg-slate-100"
                                    : "hover:bg-slate-100"
                            }`}
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    onSelectConversation(
                                        conversation.id,
                                    )
                                }
                                className={`min-w-0 flex-1 truncate px-3 py-2 text-left text-sm ${
                                    activeConversationId === conversation.id
                                        ? "font-semibold text-slate-900"
                                        : "font-medium text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                {conversation.title}
                            </button>

                            <button
                                type="button"
                                onClick={(event) =>
                                    handleDelete(
                                        event,
                                        conversation.id,
                                    )
                                }
                                aria-label={`Delete ${conversation.title}`}
                                className="mr-1 rounded-md px-2 py-1 text-xs text-slate-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
                            >
                                ✗
                            </button>
                        </div>
                    ))}
                </div>

                <Link
                    className="mt-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    href="/history"
                >
                    Chat History
                </Link>

                <Link
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    href="/upload"
                >
                    Upload Documents
                </Link>
            </nav>

            <div className="mt-auto flex items-center gap-2 border-t border-slate-200 pt-4">
                <Link
                    className="flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    href="/settings"
                >
                    Settings
                </Link>

                <Link
                    className="flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    href="/profile"
                >
                    Profile
                </Link>
            </div>
        </aside>
    );
}