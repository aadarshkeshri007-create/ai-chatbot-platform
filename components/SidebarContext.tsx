"use client";

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
} from "react";

type Conversation = {
    id: string;
    title: string;
    updated_at: string;
};

type SidebarContextValue = {
    /* ── Mobile Sidebar Drawer (open/close) ──── */
    sidebarOpen: boolean;
    openSidebar: () => void;
    closeSidebar: () => void;
    toggleSidebar: () => void;

    /* ── Desktop Collapsible Rail (collapse/expand) ── */
    collapsed: boolean;
    toggleCollapsed: () => void;

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

const COLLAPSED_STORAGE_KEY = "supportai-sidebar-collapsed";

const SidebarContext =
    createContext<SidebarContextValue>({
        sidebarOpen: false,
        openSidebar: noop,
        closeSidebar: noop,
        toggleSidebar: noop,

        collapsed: false,
        toggleCollapsed: noop,

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

    const [collapsed, setCollapsed] =
        useState(false);

    /* Restore collapsed preference from localStorage */
    useEffect(() => {
        try {
            const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
            if (stored === "true") {
                setCollapsed(true);
            }
        } catch {
            // localStorage not available
        }
    }, []);

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

    const toggleCollapsed = useCallback(() => {
        setCollapsed((prev) => {
            const next = !prev;
            try {
                localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
            } catch {
                // Ignore
            }
            return next;
        });
    }, []);

    return (
        <SidebarContext.Provider
            value={{
                sidebarOpen,
                openSidebar,
                closeSidebar,
                toggleSidebar,

                collapsed,
                toggleCollapsed,

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
