"use client";

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

import { createClient } from "@/lib/supabase/client";
import { isMissingSchemaFieldError, logSupabaseError } from "@/lib/supabase/error";
import {
    DEFAULT_ASSISTANT_NAME,
    DEFAULT_SUGGESTED_QUESTIONS,
    DEFAULT_WELCOME_MESSAGE,
    getAssistantSettings,
} from "@/lib/assistant-settings";

import type { Message } from "@/types/message";

import { useSidebarContext } from "@/components/SidebarContext";
import ChatMessages from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";

const BOTTOM_THRESHOLD_PX = 24;

type ChatSource = {
    documentId: string;
    fileName: string;
};

export default function ChatPage() {
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const [conversationId, setConversationId] =
        useState<string | null>(null);

    const [sources, setSources] =
        useState<ChatSource[]>([]);
    const [assistantName, setAssistantName] = useState(DEFAULT_ASSISTANT_NAME);
    const [welcomeMessage, setWelcomeMessage] = useState(DEFAULT_WELCOME_MESSAGE);
    const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([
        ...DEFAULT_SUGGESTED_QUESTIONS,
    ]);
    const [assistantSettingsLoading, setAssistantSettingsLoading] = useState(true);

    const messagesContainerRef =
        useRef<HTMLElement | null>(null);

    const shouldAutoScrollRef =
        useRef(true);

    const [messages, setMessages] =
        useState<Message[]>([
            {
                id: "new-chat",
                role: "assistant",
                content:
                    DEFAULT_WELCOME_MESSAGE,
            },
        ]);

    /*
     * ── Bridge to sidebar context ────────────
     * Provide conversation state and callbacks
     * to the Sidebar via context.
     */
    const {
        setConversations,
        setActiveConversationId,
        setOnSelectConversation,
        setOnNewChat,
        setOnDeleteConversation,
    } = useSidebarContext();

    const scrollToBottom = useCallback(() => {
        const container =
            messagesContainerRef.current;

        if (container) {
            container.scrollTop =
                container.scrollHeight;
        }
    }, []);

    const handleMessagesScroll =
        useCallback(() => {
            const container =
                messagesContainerRef.current;

            if (!container) {
                return;
            }

            const distanceFromBottom =
                container.scrollHeight -
                container.scrollTop -
                container.clientHeight;

            shouldAutoScrollRef.current =
                distanceFromBottom <=
                BOTTOM_THRESHOLD_PX;
        }, []);

    useLayoutEffect(() => {
        if (shouldAutoScrollRef.current) {
            scrollToBottom();
        }
    }, [messages, scrollToBottom]);

    useEffect(() => {
        const loadAssistantSettings = async () => {
            try {
                const supabase = createClient();
                const { data: { user }, error: userError } = await supabase.auth.getUser();

                if (userError || !user) return;

                let { data, error } = await supabase
                    .from("profiles")
                    .select("assistant_name, welcome_message, suggested_questions")
                    .eq("id", user.id)
                    .maybeSingle();

                if (isMissingSchemaFieldError(error)) {
                    // suggested_questions ships in its own migration. Until that
                    // migration is applied, load the core assistant identity and
                    // fall back to the default questions instead of failing.
                    console.warn(
                        "Assistant settings: suggested_questions is not available, using the default suggested questions.",
                        { code: error?.code, message: error?.message },
                    );
                    ({ data, error } = await supabase
                        .from("profiles")
                        .select("assistant_name, welcome_message")
                        .eq("id", user.id)
                        .maybeSingle());
                }

                if (error) {
                    logSupabaseError("Assistant settings load error:", error);
                    return;
                }

                const settings = getAssistantSettings(data);
                setAssistantName(settings.assistantName);
                setWelcomeMessage(settings.welcomeMessage);
                setSuggestedQuestions(settings.suggestedQuestions);
                setMessages((currentMessages) =>
                    currentMessages.length === 1 && currentMessages[0].id === "new-chat"
                        ? [{ ...currentMessages[0], content: settings.welcomeMessage }]
                        : currentMessages,
                );
            } catch (error) {
                console.error("Assistant settings load error:", error);
            } finally {
                setAssistantSettingsLoading(false);
            }
        };

        loadAssistantSettings();
    }, []);

    // Load the user's conversations
    useEffect(() => {
        const loadConversations = async () => {
            const supabase = createClient();

            const { data, error } =
                await supabase
                    .from("conversations")
                    .select(
                        "id, title, updated_at",
                    )
                    .order("updated_at", {
                        ascending: false,
                    });

            if (error) {
                console.error(
                    "Error loading conversations:",
                    error,
                );

                return;
            }

            setConversations(data ?? []);
        };

        loadConversations();
    }, [setConversations]);

    // Sync active conversation ID to context
    useEffect(() => {
        setActiveConversationId(conversationId);
    }, [conversationId, setActiveConversationId]);

    // Start a new chat
    const handleNewChat = useCallback(() => {
        setConversationId(null);

        setMessages([
            {
                id: "new-chat",
                role: "assistant",
                content:
                    welcomeMessage,
            },
        ]);

        setMessage("");
        setSources([]);
        shouldAutoScrollRef.current = true;
    }, [welcomeMessage]);

    const handleDeleteConversation =
        useCallback(async (
            conversationIdToDelete: string,
        ) => {
            const supabase = createClient();

            const { error } =
                await supabase
                    .from("conversations")
                    .delete()
                    .eq(
                        "id",
                        conversationIdToDelete,
                    );

            if (error) {
                console.error(
                    "Error deleting conversation:",
                    error,
                );

                window.alert(
                    "Unable to delete the conversation. Please try again.",
                );

                return;
            }

            setConversations(
                (prevConversations) =>
                    prevConversations.filter(
                        (conversation) =>
                            conversation.id !==
                            conversationIdToDelete,
                    ),
            );

            if (
                conversationId ===
                conversationIdToDelete
            ) {
                setConversationId(null);

                setMessages([
                    {
                        id: "new-chat",
                        role: "assistant",
                        content:
                            welcomeMessage,
                    },
                ]);

                setMessage("");
                setSources([]);
                shouldAutoScrollRef.current =
                    true;
            }
        }, [conversationId, setConversations, welcomeMessage]);

    // Load a conversation
    const handleSelectConversation =
        useCallback(async (
            selectedConversationId: string,
        ) => {
            if (loading) {
                return;
            }

            setConversationId(
                selectedConversationId,
            );

            setLoading(true);
            setSources([]);

            try {
                const supabase =
                    createClient();

                const { data, error } =
                    await supabase
                        .from("messages")
                        .select(
                            "id, role, content",
                        )
                        .eq(
                            "conversation_id",
                            selectedConversationId,
                        )
                        .order(
                            "created_at",
                            {
                                ascending: true,
                            },
                        );

                if (error) {
                    throw error;
                }

                setMessages(
                    (data ?? []).map(
                        (msg) => ({
                            id: msg.id,
                            role: msg.role,
                            content:
                                msg.content,
                        }),
                    ),
                );

                shouldAutoScrollRef.current =
                    true;
            } catch (error) {
                console.error(
                    "Error loading conversation:",
                    error,
                );

                setMessages([
                    {
                        id: "error",
                        role: "assistant",
                        content:
                            "Unable to load this conversation.",
                    },
                ]);
            } finally {
                setLoading(false);
            }
        }, [loading]);

    /*
     * ── Register callbacks with context ──────
     * So the Sidebar (rendered in the layout)
     * can trigger these functions.
     */
    useEffect(() => {
        setOnSelectConversation(
            handleSelectConversation,
        );
    }, [handleSelectConversation, setOnSelectConversation]);

    useEffect(() => {
        setOnNewChat(handleNewChat);
    }, [handleNewChat, setOnNewChat]);

    useEffect(() => {
        setOnDeleteConversation(
            handleDeleteConversation,
        );
    }, [handleDeleteConversation, setOnDeleteConversation]);

    const generateConversationTitle =
        (text: string) => {
            const cleanedText = text
                .replace(/\s+/g, " ")
                .trim();

            if (cleanedText.length <= 40) {
                return cleanedText;
            }

            return (
                cleanedText
                    .slice(0, 40)
                    .trimEnd() + "..."
            );
        };

    const handleSuggestionClick =
        (text: string) => {
            setMessage(text);
        };

    const handleSendMessage = async () => {
        if (!message.trim() || loading) {
            return;
        }

        const userMessage = message;

        const assistantMessageId =
            crypto.randomUUID();

        shouldAutoScrollRef.current = true;

        setMessages((prevMessages) => [
            ...prevMessages,
            {
                id: crypto.randomUUID(),
                role: "user",
                content: userMessage,
            },
            {
                id: assistantMessageId,
                role: "assistant",
                content: "",
            },
        ]);

        setLoading(true);
        setMessage("");
        setSources([]);

        try {
            const response = await fetch(
                "/api/chat",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        message: userMessage,
                        conversationId,
                    }),
                },
            );

            if (!response.ok) {
                let errorMessage =
                    "Failed to fetch AI response.";

                try {
                    const errorData =
                        await response.json();

                    if (
                        errorData?.error &&
                        typeof errorData.error ===
                            "string"
                    ) {
                        errorMessage =
                            errorData.error;
                    }
                } catch {
                    // Ignore JSON parsing errors.
                }

                throw new Error(
                    errorMessage,
                );
            }

            /*
             * Get source metadata from the
             * response header.
             */

            const sourcesHeader =
                response.headers.get(
                    "X-Chat-Sources",
                );

            if (sourcesHeader) {
                try {
                    const parsedSources =
                        JSON.parse(
                            sourcesHeader,
                        );

                    if (
                        Array.isArray(
                            parsedSources,
                        )
                    ) {
                        setSources(
                            parsedSources,
                        );
                    }
                } catch (error) {
                    console.error(
                        "Failed to parse chat sources:",
                        error,
                    );

                    setSources([]);
                }
            }

            /*
             * Get the conversation ID returned
             * by the API.
             */

            const returnedConversationId =
                response.headers.get(
                    "X-Conversation-Id",
                );

            if (returnedConversationId) {
                setConversationId(
                    returnedConversationId,
                );
            }

            /*
             * If this is a new conversation,
             * generate its title.
             */

            if (
                !conversationId &&
                returnedConversationId
            ) {
                const supabase =
                    createClient();

                const title =
                    generateConversationTitle(
                        userMessage,
                    );

                const {
                    error: titleError,
                } = await supabase
                    .from("conversations")
                    .update({
                        title,
                    })
                    .eq(
                        "id",
                        returnedConversationId,
                    );

                if (titleError) {
                    console.error(
                        "Error updating conversation title:",
                        titleError,
                    );
                }
            }

            /*
             * Read the streamed AI response.
             */

            const reader =
                response.body?.getReader();

            if (!reader) {
                throw new Error(
                    "Response body is missing",
                );
            }

            const decoder =
                new TextDecoder();

            let pendingContent = "";

            let updateFrame:
                | number
                | null = null;

            const flushPendingContent =
                () => {
                    updateFrame = null;

                    if (!pendingContent) {
                        return;
                    }

                    const content =
                        pendingContent;

                    pendingContent = "";

                    setMessages(
                        (prevMessages) =>
                            prevMessages.map(
                                (msg) =>
                                    msg.id ===
                                    assistantMessageId
                                        ? {
                                              ...msg,
                                              content:
                                                  msg.content +
                                                  content,
                                          }
                                        : msg,
                            ),
                    );
                };

            while (true) {
                const { done, value } =
                    await reader.read();

                if (done) {
                    break;
                }

                pendingContent +=
                    decoder.decode(
                        value,
                        {
                            stream: true,
                        },
                    );

                if (
                    updateFrame === null
                ) {
                    updateFrame =
                        requestAnimationFrame(
                            flushPendingContent,
                        );
                }
            }

            pendingContent +=
                decoder.decode();

            if (
                updateFrame !== null
            ) {
                cancelAnimationFrame(
                    updateFrame,
                );
            }

            flushPendingContent();

            /*
             * Refresh the conversation list.
             */

            const supabase =
                createClient();

            const { data } =
                await supabase
                    .from("conversations")
                    .select(
                        "id, title, updated_at",
                    )
                    .order(
                        "updated_at",
                        {
                            ascending: false,
                        },
                    );

            setConversations(data ?? []);
        } catch (error) {
            console.error(error);

            setMessages(
                (prevMessages) =>
                    prevMessages.map(
                        (msg) =>
                            msg.id ===
                            assistantMessageId
                                ? {
                                      ...msg,
                                      content:
                                          "Something went wrong. Please try again.",
                                  }
                                : msg,
                    ),
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <ChatMessages
                messages={messages}
                messagesContainerRef={
                    messagesContainerRef
                }
                onScroll={
                    handleMessagesScroll
                }
                loading={loading}
                onSuggestionClick={
                    handleSuggestionClick
                }
                assistantName={assistantName}
                welcomeMessage={welcomeMessage}
                suggestions={suggestedQuestions}
                assistantSettingsLoading={assistantSettingsLoading}
            />

            {sources.length > 0 && (
                <div className="border-t border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900 transition-colors duration-150">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Sources
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                        {sources.map(
                            (source) => (
                                <span
                                    key={
                                        source.documentId
                                    }
                                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:border dark:border-slate-700/50"
                                >
                                    📄{" "}
                                    {
                                        source.fileName
                                    }
                                </span>
                            ),
                        )}
                    </div>
                </div>
            )}

            <ChatInput
                message={message}
                setMessage={setMessage}
                onSend={
                    handleSendMessage
                }
                loading={loading}
            />
        </>
    );
}
