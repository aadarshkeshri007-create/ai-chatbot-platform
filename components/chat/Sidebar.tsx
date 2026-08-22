"use client";

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

export default function Sidebar({
    conversations,
    activeConversationId,
    onSelectConversation,
    onNewChat,
    onDeleteConversation,
    isOpen,
    onClose,
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
                    <div className="flex items-center gap-2.5">
                        <div
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600"
                            aria-hidden="true"
                        >
                            <span className="text-xs font-bold text-white">AI</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">
                            SupportAI
                        </span>
                    </div>

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

                {/* ── New Chat ───────────────────────────── */}
                <div className="px-3 pt-3 pb-1">
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

                {/* ── Conversations ──────────────────────── */}
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

            </aside>
        </>
    );
}