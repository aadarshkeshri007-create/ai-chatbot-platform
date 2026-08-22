"use client";

import {
    createContext,
    useContext,
    useState,
    useCallback,
} from "react";

type Conversation = {
    id: string;
    title: string;
    updated_at: string;
};

type SidebarContextValue = {
    /* ── Sidebar visibility ─────────────────── */
    sidebarOpen: boolean;
    openSidebar: () => void;
    closeSidebar: () => void;
    toggleSidebar: () => void;

    /* ── Chat-specific state ────────────────── */
    conversations: Conversation[];
    setConversations: React.Dispatch<
        React.SetStateAction<Conversation[]>
    >;
    activeConversationId: string | null;
    onSelectConversation: (id: string) => void;
    setOnSelectConversation: (
        fn: (id: string) => void,
    ) => void;
    onNewChat: () => void;
    setOnNewChat: (fn: () => void) => void;
    onDeleteConversation: (id: string) => void;
    setOnDeleteConversation: (
        fn: (id: string) => void,
    ) => void;
    setActiveConversationId: React.Dispatch<
        React.SetStateAction<string | null>
    >;
};

const noop = () => {};
const noopWithId = (_id: string) => {};

const SidebarContext =
    createContext<SidebarContextValue>({
        sidebarOpen: false,
        openSidebar: noop,
        closeSidebar: noop,
        toggleSidebar: noop,

        conversations: [],
        setConversations: noop,
        activeConversationId: null,
        onSelectConversation: noopWithId,
        setOnSelectConversation: noop,
        onNewChat: noop,
        setOnNewChat: noop,
        onDeleteConversation: noopWithId,
        setOnDeleteConversation: noop,
        setActiveConversationId: noop,
    });

export function SidebarProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] =
        useState(false);

    const [conversations, setConversations] =
        useState<Conversation[]>([]);

    const [activeConversationId, setActiveConversationId] =
        useState<string | null>(null);

    /*
     * These callbacks are provided by the chat page.
     * We store them in state so the Sidebar can call them
     * regardless of which page is active.
     */
    const [selectConversationFn, setSelectConversationFn] =
        useState<(id: string) => void>(
            () => noopWithId,
        );

    const [newChatFn, setNewChatFn] = useState<
        () => void
    >(() => noop);

    const [deleteConversationFn, setDeleteConversationFn] =
        useState<(id: string) => void>(
            () => noopWithId,
        );

    const openSidebar = useCallback(
        () => setSidebarOpen(true),
        [],
    );

    const closeSidebar = useCallback(
        () => setSidebarOpen(false),
        [],
    );

    const toggleSidebar = useCallback(
        () =>
            setSidebarOpen((prev) => !prev),
        [],
    );

    return (
        <SidebarContext.Provider
            value={{
                sidebarOpen,
                openSidebar,
                closeSidebar,
                toggleSidebar,

                conversations,
                setConversations,
                activeConversationId,
                setActiveConversationId,
                onSelectConversation:
                    selectConversationFn,
                setOnSelectConversation: (
                    fn,
                ) =>
                    setSelectConversationFn(
                        () => fn,
                    ),
                onNewChat: newChatFn,
                setOnNewChat: (fn) =>
                    setNewChatFn(() => fn),
                onDeleteConversation:
                    deleteConversationFn,
                setOnDeleteConversation: (
                    fn,
                ) =>
                    setDeleteConversationFn(
                        () => fn,
                    ),
            }}
        >
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebarContext() {
    return useContext(SidebarContext);
}
