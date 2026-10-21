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
import { generateClientUuid } from "@/lib/client-uuid";
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
import OnboardingChecklist from "@/components/OnboardingChecklist";
import FeedbackReviewPanel from "@/components/chat/FeedbackReviewPanel";
import { getConversationLoadErrorMessage, normalizeOwnedTestConversations, UNAUTHENTICATED_CONVERSATION_MESSAGE } from "@/lib/conversation-load";
import { getSafeChatFailureCode, getSafeChatFailureMessage } from "@/lib/chat-errors";
import { finishChatRequest, tryStartChatRequest } from "@/lib/chat-request-guard";
import { shouldAutoScrollToBottom } from "@/lib/chat-scroll";

const BOTTOM_THRESHOLD_PX = 24;

type ChatSource = {
    documentId: string;
    fileName: string;
    chunkId?: string;
    chunkIndex?: number;
};

export default function ChatPage() {
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);

    const [conversationId, setConversationId] =
        useState<string | null>(null);

    const [assistantName, setAssistantName] = useState(DEFAULT_ASSISTANT_NAME);
    const [welcomeMessage, setWelcomeMessage] = useState(DEFAULT_WELCOME_MESSAGE);
    const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([
        ...DEFAULT_SUGGESTED_QUESTIONS,
    ]);
    const [assistantSettingsLoading, setAssistantSettingsLoading] = useState(true);
    const [conversationLoadError, setConversationLoadError] = useState<string | null>(null);
    const [conversationListLoading, setConversationListLoading] = useState(true);

    const messagesContainerRef =
        useRef<HTMLElement | null>(null);

    const shouldAutoScrollRef =
        useRef(true);
    const chatRequestLockRef = useRef({ current: false });

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

            shouldAutoScrollRef.current = shouldAutoScrollToBottom(
                container.scrollHeight,
                container.scrollTop,
                container.clientHeight,
                BOTTOM_THRESHOLD_PX,
            );
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

    // Load only the signed-in owner's test conversations for their assistant.
    const loadConversations = useCallback(async () => {
        setConversationListLoading(true);
        setConversationLoadError(null);
        try {
            const supabase = createClient();
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError) {
                logSupabaseError("Chat conversation auth error:", authError);
                setConversationLoadError(UNAUTHENTICATED_CONVERSATION_MESSAGE);
                return;
            }
            if (!user) {
                setConversationLoadError(UNAUTHENTICATED_CONVERSATION_MESSAGE);
                return;
            }

            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("assistant_id")
                .eq("id", user.id)
                .maybeSingle();
            if (profileError) {
                logSupabaseError("Chat conversation profile error:", profileError);
                setConversationLoadError("We couldn’t load your assistant workspace. Retry in a moment.");
                return;
            }
            if (!profile?.assistant_id) {
                setConversationLoadError("Your assistant workspace isn’t ready yet. Retry in a moment.");
                return;
            }

            const { data, error } = await supabase
                .from("conversations")
                .select("id, title, updated_at, user_id, assistant_id, is_test")
                .eq("user_id", user.id)
                .eq("assistant_id", profile.assistant_id)
                .eq("is_test", true)
                .order("updated_at", { ascending: false });

            if (error) {
                logSupabaseError("Chat conversation list error:", error);
                setConversationLoadError(getConversationLoadErrorMessage(error));
                return;
            }
            const conversations = normalizeOwnedTestConversations(data, user.id, profile.assistant_id);
            if (!conversations) {
                console.error("Chat conversation list returned an invalid response shape.");
                setConversationLoadError("We received an unexpected response while loading conversations. Retry.");
                return;
            }
            setConversations(conversations);
        } catch (error) {
            const safeError = error instanceof Error
                ? { name: error.name }
                : { name: "UnknownError" };
            console.error("Chat conversation list request failed:", JSON.stringify(safeError));
            setConversationLoadError("We couldn’t load saved test conversations. Check your connection and retry.");
        } finally {
            setConversationListLoading(false);
        }
    }, [setConversations]);

    useEffect(() => {
        queueMicrotask(() => void loadConversations());
    }, [loadConversations]);

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

            try {
                const supabase =
                    createClient();

                const { data, error } =
                    await supabase
                        .from("messages")
                        .select(
                            "id, role, content, sources",
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
                            sources: Array.isArray(msg.sources) ? msg.sources as Message["sources"] : [],
                            retrievalState: Array.isArray(msg.sources) && msg.sources.length > 0 ? "supported" : "insufficient",
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

    const submitAnswerFeedback = async (
        assistant: Message,
        question: Message,
        feedbackType: "helpful" | "not_helpful" | "report_issue",
        category?: string,
    ) => {
        if (!conversationId) throw new Error("Wait until the test response has been saved before sending feedback.");
        const response = await fetch("/api/chat/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                conversationId,
                userMessageId: question.id,
                assistantMessageId: assistant.id,
                requestId: generateClientUuid(),
                feedbackType,
                category,
            }),
        });
        const result = await response.json().catch(() => null) as { error?: string } | null;
        if (!response.ok) throw new Error(result?.error || "Unable to save feedback.");
    };

    const handleSendMessage = async () => {
        if (!message.trim() || loading || !tryStartChatRequest(chatRequestLockRef.current)) {
            return;
        }

        const userMessage = message;

        let userMessageId: string;
        let assistantMessageId: string;

        try {
            userMessageId = generateClientUuid();
            assistantMessageId = generateClientUuid();

            setMessages((prevMessages) => [
                ...prevMessages,
                {
                    id: userMessageId,
                    role: "user",
                    content: userMessage,
                },
                {
                    id: assistantMessageId,
                    role: "assistant",
                    content: "",
                },
            ]);
        } catch (error) {
            console.error("Unable to create chat message identifiers:", JSON.stringify({ name: error instanceof Error ? error.name : "UnknownError" }));
            setChatError(
                "Unable to start the chat. Please use a supported browser.",
            );
            finishChatRequest(chatRequestLockRef.current);
            return;
        }

        shouldAutoScrollRef.current = true;
        setChatError(null);

        setLoading(true);
        setMessage("");

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
                        userMessageId,
                        assistantMessageId,
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
                        errorMessage = getSafeChatFailureMessage(new Error(errorData.error));
                    }
                    if (errorData?.code === "DEADLINE_EXCEEDED") {
                        errorMessage = getSafeChatFailureMessage({ status: 504 });
                    }
                } catch {
                    // Ignore JSON parsing errors.
                }

                if (response.status === 504) {
                    errorMessage = getSafeChatFailureMessage({ status: 504 });
                }

                throw new Error(
                    errorMessage,
                );
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
            let streamBuffer = "";
            let streamComplete = false;

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

            const processEvent = (block: string) => {
                let eventName = "message";
                const dataLines: string[] = [];
                for (const line of block.split("\n")) {
                    if (line.startsWith("event:")) eventName = line.slice(6).trim();
                    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
                }
                if (!dataLines.length) return;
                const payload = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
                if (eventName === "delta" && typeof payload.text === "string") {
                    pendingContent += payload.text;
                    if (updateFrame === null) updateFrame = requestAnimationFrame(flushPendingContent);
                } else if (eventName === "complete") {
                    streamComplete = true;
                    const completedSources = Array.isArray(payload.sources) ? payload.sources as ChatSource[] : [];
                    if (typeof payload.userMessageId === "string" && typeof payload.assistantMessageId === "string") {
                        setMessages((current) => current.map((item) =>
                            item.id === userMessageId ? { ...item, id: payload.userMessageId as string } :
                            item.id === assistantMessageId ? {
                                ...item,
                                id: payload.assistantMessageId as string,
                                sources: completedSources.map((source) => ({ label: source.fileName, document_id: source.documentId, chunk_id: source.chunkId, chunk_index: source.chunkIndex })),
                                retrievalState: payload.retrievalState === "supported" ? "supported" : "insufficient",
                            } : item));
                    }
                } else if (eventName === "error") {
                    const error = new Error(getSafeChatFailureMessage(payload)) as Error & { chatFailureCode: string };
                    error.chatFailureCode = getSafeChatFailureCode(payload);
                    throw error;
                }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                streamBuffer += decoder.decode(value, { stream: true });
                const blocks = streamBuffer.split("\n\n");
                streamBuffer = blocks.pop() ?? "";
                for (const block of blocks) processEvent(block);
            }
            streamBuffer += decoder.decode();
            if (streamBuffer.trim()) processEvent(streamBuffer);

            if (
                updateFrame !== null
            ) {
                cancelAnimationFrame(
                    updateFrame,
                );
            }

            flushPendingContent();
            if (!streamComplete) throw new Error("The assistant stream ended before completion. Please retry.");

            /*
             * Refresh the conversation list.
             */

            void loadConversations();
        } catch (error) {
            const safeFailureMessage = getSafeChatFailureMessage(error);
            console.error("Chat submission failed:", JSON.stringify({
                name: error instanceof Error ? error.name : "UnknownError",
                code: error && typeof error === "object" && "chatFailureCode" in error
                    ? (error as { chatFailureCode?: string }).chatFailureCode
                    : getSafeChatFailureCode(error),
            }));
            setChatError(safeFailureMessage);

            setMessages(
                (prevMessages) =>
                    prevMessages.map(
                        (msg) =>
                            msg.id ===
                            assistantMessageId
                                ? {
                                      ...msg,
                                      content:
                                          safeFailureMessage,
                                  }
                                : msg,
                    ),
            );
        } finally {
            setLoading(false);
            finishChatRequest(chatRequestLockRef.current);
        }
    };

    return (
        <>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 sm:px-6">
                <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">Test your assistant</p>
                    <span title="Test sessions are kept separate from visitor conversations." className="shrink-0 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]"><span className="hidden sm:inline">Private test session</span><span className="sm:hidden">Private</span></span>
                </div>
                <FeedbackReviewPanel />
            </div>
            <OnboardingChecklist />
            {conversationLoadError && (
                <div role="alert" className="shrink-0 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 sm:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p>{conversationLoadError}</p>
                        <button type="button" onClick={() => void loadConversations()} disabled={conversationListLoading} className="rounded-md border border-current px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-60">
                            {conversationListLoading ? "Retrying…" : "Retry"}
                        </button>
                    </div>
                </div>
            )}
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
                onFeedback={submitAnswerFeedback}
            />

            {chatError && (
                <p
                    role="alert"
                    className="shrink-0 border-t border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                >
                    {chatError}
                </p>
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
