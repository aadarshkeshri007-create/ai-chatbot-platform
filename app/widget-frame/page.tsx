"use client";

import { FormEvent, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import MessageContent from "@/components/chat/MessageContent";
import {
  formatRateLimitMessage,
  classifyWidgetSender,
  isWidgetChatResponse,
  isTrustedWidgetMessage,
  WIDGET_MAX_MESSAGE_LENGTH,
  WIDGET_REQUEST_TIMEOUT_MS,
  resolveWidgetParentOrigin,
} from "@/lib/widget-protocol";
import {
  DEFAULT_BRAND_COLOR,
  getBrandLinkColor,
  getBrandTextColor,
  normalizeBrandColor,
} from "@/lib/brand-color";
import { canSubmitWidgetMessage } from "@/lib/widget-send-state";
import {
  clearHandoffAccess,
  readHandoffAccess,
  saveHandoffAccess,
} from "@/lib/handoff-session";
import { getHandoffPollOutcome } from "@/lib/handoff-resolution";
import {
  classifyPendingQuestion,
  clearPendingQuestion,
  readPendingQuestion,
  savePendingQuestion,
} from "@/lib/widget-pending";

type Source = { label: string; document_id?: string; chunk_id?: string; chunk_index?: number };
type ChatMessage = {
  role: "user" | "assistant" | "human" | "system";
  content: string;
  sources?: Source[];
  timestamp?: string;
  requestId?: string;
};
type HandoffMessage = { id: string; role: "human"; content: string; created_at?: string };

const FALLBACK_WELCOME = "Hello! How can I help you today?";
type HandoffAccess = { id: string; token: string };

function readSavedHandoffAccess(assistantId: string): HandoffAccess | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("reset") === "1" || params.get("reset") === "true") {
    clearHandoffAccess(localStorage);
    return null;
  }
  return readHandoffAccess(assistantId, localStorage);
}

function subscribeToHandoffStorage(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function parseHandoffAccessSnapshot(snapshot: string): HandoffAccess | null {
  if (!snapshot) return null;
  try {
    const value = JSON.parse(snapshot) as { id?: unknown; token?: unknown };
    return typeof value.id === "string" && typeof value.token === "string"
      ? { id: value.id, token: value.token }
      : null;
  } catch {
    return null;
  }
}

export default function WidgetFrame() {
  const [assistantId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("assistant_id") ?? "",
  );
  const [assistantName, setAssistantName] = useState("Support");
  const [brandColor, setBrandColor] = useState(() =>
    typeof window === "undefined"
      ? DEFAULT_BRAND_COLOR
      : normalizeBrandColor(new URLSearchParams(window.location.search).get("brand_color")) ?? DEFAULT_BRAND_COLOR,
  );
  const [welcomeMessage, setWelcomeMessage] = useState(FALLBACK_WELCOME);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: FALLBACK_WELCOME },
  ]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingStarted, setStreamingStarted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("supportai:widget-theme");
      if (saved === "light" || saved === "dark") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTheme(saved);
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
      }
    } catch {
      // localStorage not accessible
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      try {
        const saved = localStorage.getItem("supportai:widget-theme");
        if (!saved) {
          setTheme(e.matches ? "dark" : "light");
        }
      } catch {
        setTheme(e.matches ? "dark" : "light");
      }
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("supportai:widget-theme", next);
      } catch {
        // localStorage not available
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(theme);
    }
  }, [theme]);

  const [showContactForm, setShowContactForm] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactNotice, setContactNotice] = useState("");
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [escalatedTurnId, setEscalatedTurnId] = useState<string | null>(null);

  const [handoffEnabled, setHandoffEnabled] = useState(true);
  const [handoffIntro, setHandoffIntro] = useState("You can send a request to the support team. A reply may not be immediate.");
  const [leadNotice, setLeadNotice] = useState("");
  const [handoffPollUnavailable, setHandoffPollUnavailable] = useState(false);
  const getHandoffAccessSnapshot = useCallback(() => {
    const saved = readSavedHandoffAccess(assistantId);
    return saved ? JSON.stringify(saved) : "";
  }, [assistantId]);
  const savedHandoffSnapshot = useSyncExternalStore(
    subscribeToHandoffStorage,
    getHandoffAccessSnapshot,
    () => "",
  );
  const [localHandoffAccess, setLocalHandoffAccess] = useState<HandoffAccess | null | undefined>(undefined);
  const handoffAccess = localHandoffAccess === undefined
    ? parseHandoffAccessSnapshot(savedHandoffSnapshot)
    : localHandoffAccess;
  const [handoffNotice, setHandoffNotice] = useState("");
  const visibleHandoffNotice = handoffNotice ||
    (handoffAccess ? "Your support request is active. A team member may respond later." : "");
  const [seenHumanMessages, setSeenHumanMessages] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const retryRef = useRef<{ requestId: string; message: string } | null>(null);
  const completedHandoffsRef = useRef(new Set<string>());
  const restoreRequestedRef = useRef(false);
  const parentOrigin = typeof window === "undefined"
    ? ""
    : resolveWidgetParentOrigin(window.location.search, document.referrer);

  const postToParent = useCallback((data: unknown) => {
    if (typeof window === "undefined" || !parentOrigin || window.parent === window) return;
    try {
      window.parent.postMessage(data, parentOrigin);
    } catch {
      // Ignored if target origin is not reachable
    }
  }, [parentOrigin]);

  const RESTORE_TIMEOUT_MS = 15_000;
  const [restoreState, setRestoreState] = useState<"loading" | "ready" | "failed">("loading");
  const [restoreNotice, setRestoreNotice] = useState("");
  const restoreRequestIdRef = useRef("");
  const restoreTimerRef = useRef<number | undefined>(undefined);

  /**
   * Ask the host-page loader to restore this visitor's conversation. The loader
   * owns the opaque resume credential; this frame never sees it. Without a
   * parent (standalone preview) there is nothing to restore, so we do not
   * leave the widget in a loading state.
   */
  const requestRestore = useCallback(() => {
    window.clearTimeout(restoreTimerRef.current);
    if (!parentOrigin || window.parent === window) {
      setRestoreState("ready");
      return;
    }
    setRestoreState("loading");
    setRestoreNotice("");
    restoreRequestIdRef.current = crypto.randomUUID();
    postToParent({ type: "supportai:restore-request", requestId: restoreRequestIdRef.current, assistantId });
    restoreTimerRef.current = window.setTimeout(() => {
      setRestoreState((current) => (current === "loading" ? "failed" : current));
    }, RESTORE_TIMEOUT_MS);
  }, [assistantId, parentOrigin, postToParent]);

  /**
   * Clear the visitor's local handoff session without modifying any
   * server-side record. The handoff_requests row remains open in the
   * database and is still accessible through the owner's dashboard.
   * This is the correct action when the visitor wants to start a fresh
   * AI conversation (e.g. during local demo testing) or when the server
   * already marked the handoff as resolved but the browser didn't catch it.
   */
  const clearLocalSession = useCallback(() => {
    clearHandoffAccess(localStorage);
    clearPendingQuestion(assistantId, localStorage);
    retryRef.current = null;
    window.clearTimeout(restoreTimerRef.current);
    setRestoreState("ready");
    setRestoreNotice("");
    setLocalHandoffAccess(null);
    setHandoffPollUnavailable(false);
    setHandoffNotice("");
    setShowContactForm(false);
    setEscalatedTurnId(null);
    setSeenHumanMessages([]);
    setConversationId("");
    setMessages([{ role: "assistant", content: welcomeMessage }]);
  }, [assistantId, welcomeMessage]);
  const resetLocalSession = useCallback(() => {
    postToParent({ type: "supportai:rotate-visitor-session" });
    clearLocalSession();
  }, [clearLocalSession, postToParent]);

  useEffect(() => {
    const receiveMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== parentOrigin) return;
      if (event.data?.type === "supportai:restore-response") {
        if (event.data.requestId !== restoreRequestIdRef.current) return;
        window.clearTimeout(restoreTimerRef.current);
        if (event.data.ok !== true || !event.data.payload || typeof event.data.payload !== "object") {
          // Never fall back to an empty chat on failure: the stored conversation reference is untouched
          // and the visitor can retry or explicitly start a new conversation.
          setRestoreState("failed");
          return;
        }
        const payload = event.data.payload as {
          conversation_id?: unknown; messages?: unknown; expired?: unknown; escalation_request_id?: unknown;
        };
        const restored = Array.isArray(payload.messages) ? payload.messages.flatMap((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return [];
          const row = item as Record<string, unknown>;
          if ((row.role !== "user" && row.role !== "assistant") || typeof row.content !== "string") return [];
          const sources = Array.isArray(row.sources) ? row.sources.flatMap((source) =>
            source && typeof source === "object" && !Array.isArray(source) && typeof (source as { label?: unknown }).label === "string"
              ? [{ label: (source as { label: string }).label }]
              : [],
          ) : [];
          return [{
            role: row.role,
            content: row.content,
            sources,
            ...(typeof row.request_id === "string" ? { requestId: row.request_id } : {}),
          } as ChatMessage];
        }) : [];
        const pending = readPendingQuestion(assistantId, localStorage);
        if (payload.expired === true) {
          clearPendingQuestion(assistantId, localStorage);
          setRestoreNotice("Your previous conversation has expired. Ask a question to start a new one.");
        } else if (restored.length && typeof payload.conversation_id === "string") {
          setConversationId(payload.conversation_id);
          setMessages([{ role: "assistant", content: welcomeMessage }, ...restored]);
          if (typeof payload.escalation_request_id === "string") setEscalatedTurnId(payload.escalation_request_id);
        }
        if (pending && payload.expired !== true) {
          if (classifyPendingQuestion(pending, restored.map((item) => ({ role: item.role, request_id: item.requestId }))) === "answered") {
            clearPendingQuestion(assistantId, localStorage);
          } else {
            // The turn was never saved. Offer it back for an idempotent resend (same request id)
            // instead of submitting it automatically.
            retryRef.current = { requestId: pending.requestId, message: pending.message };
            setMessage((current) => current || pending.message);
            setRestoreNotice("Your last message may not have been sent. It's back in the box so you can send it again.");
          }
        }
        setRestoreState("ready");
      } else if (event.data?.type === "supportai:brand-config") {
        const nextColor = normalizeBrandColor(event.data.brand_color);
        if (nextColor) setBrandColor(nextColor);
      } else if (event.data?.type === "supportai:handoff-config") {
        if (typeof event.data.handoff_enabled === "boolean") setHandoffEnabled(event.data.handoff_enabled);
        if (typeof event.data.handoff_intro === "string" && event.data.handoff_intro.trim()) setHandoffIntro(event.data.handoff_intro.slice(0, 500));
      } else if (event.data?.type === "supportai:reset-session") {
        clearLocalSession();
      }
    };
    window.addEventListener("message", receiveMessage);
    postToParent({ type: "supportai:ready" });
    if (!restoreRequestedRef.current) {
      restoreRequestedRef.current = true;
      requestRestore();
    }
    return () => window.removeEventListener("message", receiveMessage);
  }, [assistantId, clearLocalSession, parentOrigin, postToParent, requestRestore, welcomeMessage]);
  const debugWidget = (stage: string, details: Record<string, string | number>) => {
    if (typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      console.debug(`[SupportAI widget] ${stage}`, details);
    }
  };

  useEffect(() => {
    messagesRef.current?.scrollTo(0, messagesRef.current.scrollHeight);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showContactForm) {
          setShowContactForm(false);
        } else {
          postToParent({ type: "supportai:close" });
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [postToParent, showContactForm]);

  useEffect(() => {
    messagesRef.current?.scrollTo(0, messagesRef.current.scrollHeight);
  }, [messages, loading, error]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanMessage = message.trim();
    if (!canSubmitWidgetMessage(cleanMessage, {
      loading,
      handoffActive: Boolean(handoffAccess),
      assistantReady: Boolean(assistantId),
      submissionPending: sendingRef.current,
    })) return;

    sendingRef.current = true;
    const requestId = retryRef.current?.message === cleanMessage ? retryRef.current.requestId : crypto.randomUUID();
    if (retryRef.current?.message !== cleanMessage) retryRef.current = null;
    setMessages((current) => [...current, { role: "user", content: cleanMessage, requestId }]);
    savePendingQuestion(assistantId, { requestId, message: cleanMessage }, localStorage);
    setMessage("");
    setError("");
    setLoading(true);
    setStreamingStarted(false);

    try {
      debugWidget("chat-send", { requestId, hasParentOrigin: parentOrigin ? 1 : 0 });
      const payload = await new Promise<{
        assistant_name?: string;
        welcome_message?: string;
        response?: string;
        conversation_id?: string;
        handoff_available?: boolean;
        sources?: Source[];
      }>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          window.removeEventListener("message", onMessage);
          reject(new Error("The SupportAI request timed out."));
        }, WIDGET_REQUEST_TIMEOUT_MS + 1000);

        function onMessage(event: MessageEvent) {
          if (!isTrustedWidgetMessage(event.source, window.parent, event.origin, parentOrigin) ||
            event.data?.requestId !== requestId) return;
          if (event.data?.type === "supportai:chat-stream") {
            if (event.data.event === "delta" && typeof event.data.payload?.text === "string") {
              setStreamingStarted(true);
              setMessages((current) => {
                const existing = current.findIndex((item) => item.role === "assistant" && item.requestId === requestId);
                if (existing < 0) return [...current, { role: "assistant", content: event.data.payload.text, requestId }];
                return current.map((item, index) => index === existing
                  ? { ...item, content: item.content + event.data.payload.text }
                  : item);
              });
              return;
            }
            if (event.data.event === "complete" && event.data.payload && typeof event.data.payload === "object") {
              window.clearTimeout(timeout);
              window.removeEventListener("message", onMessage);
              resolve(event.data.payload as {
                assistant_name?: string; welcome_message?: string; response?: string;
                conversation_id?: string; handoff_available?: boolean; sources?: Source[];
              });
              return;
            }
            if (event.data.event === "error") {
              window.clearTimeout(timeout);
              window.removeEventListener("message", onMessage);
              reject(new Error(typeof event.data.payload?.message === "string"
                ? event.data.payload.message
                : "The assistant response could not be completed."));
            }
            return;
          }
          if (!isWidgetChatResponse(event.data)) return;

          debugWidget("chat-response-received", { requestId, ok: event.data.ok ? 1 : 0 });
          window.clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          if (!event.data.ok) {
            reject(new Error(
              event.data.status === 429
                ? formatRateLimitMessage(event.data.retryAfterSeconds ?? null)
                : event.data.error,
            ));
            return;
          }
          resolve(event.data.payload as {
            assistant_name?: string;
            welcome_message?: string;
            response?: string;
            conversation_id?: string;
            handoff_available?: boolean;
            sources?: Source[];
          });
        }

        window.addEventListener("message", onMessage);
        postToParent({
          type: "supportai:chat-request",
          requestId,
          assistantId,
          message: cleanMessage,
        });
      });

      const nextWelcome = typeof payload.welcome_message === "string"
        ? payload.welcome_message
        : welcomeMessage;
      if (payload.assistant_name) setAssistantName(payload.assistant_name);
      if (nextWelcome !== welcomeMessage) {
        setWelcomeMessage(nextWelcome);
        setMessages((current) =>
          current.map((item, index) =>
            index === 0 && item.role === "assistant"
              ? { ...item, content: nextWelcome }
              : item,
          ),
        );
      }
      setMessages((current) => {
        const assistant = {
          role: "assistant" as const,
          content: payload.response || "I’m sorry, I couldn’t generate a response.",
          requestId,
          sources: Array.isArray(payload.sources)
            ? payload.sources.filter((source): source is Source => Boolean(source && typeof source.label === "string"))
            : [],
        };
        const existing = current.findIndex((item) => item.role === "assistant" && item.requestId === requestId);
        return existing < 0 ? [...current, assistant] : current.map((item, index) => index === existing ? assistant : item);
      });
      if (typeof payload.conversation_id === "string") setConversationId(payload.conversation_id);
      retryRef.current = null;
      clearPendingQuestion(assistantId, localStorage);
      const isAbstention =
        payload.handoff_available === true ||
        payload.response === "I’m sorry, but the knowledge base doesn't contain enough information to answer that. Please contact the support team for help." ||
        payload.response === "I'm sorry, but the knowledge base doesn't contain enough information to answer that. You can send a request to the support team for help." ||
        payload.response === "I’m sorry, I don’t have enough information in my knowledge base to answer that question.";
      if (isAbstention) {
        setEscalatedTurnId(requestId);
        if (!contactMessage) setContactMessage(cleanMessage);
      }
    } catch (requestError) {
      retryRef.current = { requestId, message: cleanMessage };
      setMessages((current) => current.filter((item) => item.requestId !== requestId));
      setMessage(cleanMessage);
      setError(requestError instanceof Error ? requestError.message : "Unable to send your message.");
    } finally {
      sendingRef.current = false;
      setLoading(false);
      setStreamingStarted(false);
      inputRef.current?.focus();
    }
  };

  const submitContactSupport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (contactSubmitting) return;
    const cleanEmail = contactEmail.trim();
    const cleanMsg = contactMessage.trim();
    const cleanNm = contactName.trim();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setContactNotice("Please enter a valid email address so our team can follow up.");
      return;
    }
    if (!cleanMsg) {
      setContactNotice("Please enter your message or question.");
      return;
    }

    setContactSubmitting(true);
    setContactNotice("");

    try {
      const requestId = crypto.randomUUID();
      if (handoffEnabled) {
        // Submit handoff request for live support inbox
        const payload = await new Promise<Record<string, unknown>>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            window.removeEventListener("message", onMessage);
            reject(new Error("The support request timed out. Please try again."));
          }, WIDGET_REQUEST_TIMEOUT_MS + 1000);

          function onMessage(e: MessageEvent) {
            if (!isTrustedWidgetMessage(e.source, window.parent, e.origin, parentOrigin) ||
              e.data?.type !== "supportai:handoff-response" ||
              e.data.requestId !== requestId) return;
            window.clearTimeout(timeout);
            window.removeEventListener("message", onMessage);
            if (!e.data.ok) reject(new Error("Unable to submit your support request right now."));
            else resolve(e.data.payload as Record<string, unknown>);
          }
          window.addEventListener("message", onMessage);
          postToParent({
            type: "supportai:handoff-request",
            requestId,
            assistantId,
            customerName: cleanNm || undefined,
            customerEmail: cleanEmail,
            reason: cleanMsg,
            conversationId,
            transcript: messages.slice(-50).map(({ role, content }) => ({ role, content })),
          });
        });

        if (typeof payload.handoff_id === "string" && typeof payload.access_token === "string") {
          const access = { id: payload.handoff_id, token: payload.access_token };
          setLocalHandoffAccess(access);
          saveHandoffAccess(assistantId, access, localStorage);
          setHandoffPollUnavailable(false);
          setHandoffNotice("Your message has been sent to our support team. We'll follow up shortly.");
        }

        // Also submit lead in background if configured
        postToParent({
          type: "supportai:lead-request",
          requestId: crypto.randomUUID(),
          assistantId,
          name: cleanNm || "Website visitor",
          email: cleanEmail,
          question: cleanMsg,
        });

        setShowContactForm(false);
      } else {
        // Fallback to direct lead submission if handoff is disabled
        const leadResult = await new Promise<{ success?: boolean }>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            window.removeEventListener("message", onMsg);
            reject(new Error("Lead submission timed out. Please try again."));
          }, WIDGET_REQUEST_TIMEOUT_MS + 1000);

          function onMsg(e: MessageEvent) {
            if (!isTrustedWidgetMessage(e.source, window.parent, e.origin, parentOrigin) ||
              e.data?.type !== "supportai:lead-response" || e.data.requestId !== requestId) return;
            window.clearTimeout(timeout);
            window.removeEventListener("message", onMsg);
            if (e.data.ok === true) resolve(e.data.payload as { success?: boolean });
            else reject(new Error(typeof e.data.error === "string" ? e.data.error : "Unable to submit your details right now."));
          }
          window.addEventListener("message", onMsg);
          postToParent({
            type: "supportai:lead-request",
            requestId,
            assistantId,
            name: cleanNm || "Website visitor",
            email: cleanEmail,
            question: cleanMsg,
          });
        });

        if (leadResult.success) {
          setLeadNotice("Thanks! Your message has been sent to our team.");
          setShowContactForm(false);
        }
      }
    } catch (err) {
      setContactNotice(err instanceof Error ? err.message : "Unable to send your message right now.");
    } finally {
      setContactSubmitting(false);
    }
  };

  useEffect(() => {
    if (!handoffAccess || handoffPollUnavailable) return;
    const poll = () => {
      const requestId = crypto.randomUUID();
      postToParent({
        type: "supportai:handoff-poll",
        requestId,
        handoffId: handoffAccess.id,
        accessToken: handoffAccess.token,
      });
    };
    const listener = (event: MessageEvent) => {
      if (!isTrustedWidgetMessage(event.source, window.parent, event.origin, parentOrigin) ||
        event.data?.type !== "supportai:handoff-response" ||
        completedHandoffsRef.current.has(handoffAccess.id)) return;

      const outcome = getHandoffPollOutcome({
        ok: event.data.ok === true,
        status: event.data.payload?.status,
        httpStatus: event.data.status,
      });

      if (outcome === "resolved") {
        completedHandoffsRef.current.add(handoffAccess.id);
        clearHandoffAccess(localStorage);
        setLocalHandoffAccess(null);
        setHandoffPollUnavailable(false);
        setHandoffNotice("");
        setMessages((current) => [...current, {
          role: "system",
          content: "Your support request has been resolved. You can continue chatting with our AI assistant. Human-support replies are not included in AI chat context.",
        }]);
        return;
      }

      if (outcome === "unavailable") {
        setHandoffPollUnavailable(true);
        setHandoffNotice("We couldn't verify this support request. Start a new conversation to chat with the AI assistant.");
        return;
      }

      if (outcome !== "active" || !Array.isArray(event.data.payload?.messages)) return;

      const newMessages = (event.data.payload.messages as HandoffMessage[]).filter(
        (item) => item &&
          classifyWidgetSender(item.role) === "human" &&
          typeof item.id === "string" &&
          !seenHumanMessages.includes(item.id),
      );
      if (newMessages.length) {
        setMessages((current) => [...current, ...newMessages.map((item) => ({
          role: "human" as const,
          content: item.content,
          timestamp: item.created_at,
        }))]);
        setSeenHumanMessages((current) => [...current, ...newMessages.map((item) => item.id)]);
      }
    };
    window.addEventListener("message", listener);
    poll();
    const interval = window.setInterval(poll, 15000);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("message", listener);
    };
  }, [handoffAccess, handoffPollUnavailable, parentOrigin, postToParent, seenHumanMessages]);

  return (
    <main
      className={`widget ${theme === "dark" ? "dark" : "light"}`}
      style={{
        "--widget-brand": brandColor,
        "--widget-brand-text": getBrandTextColor(brandColor),
        "--widget-brand-link": getBrandLinkColor(brandColor),
      } as React.CSSProperties}
    >
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body { height: 100%; margin: 0; overflow: hidden; }
        body {
          font-family: var(--font-geist-sans, ui-sans-serif, system-ui, sans-serif);
          /* Prevent rubber-band scroll on the host page when iframe is focused */
          overscroll-behavior: none;
        }
        :root, .widget, .widget.light, :root.light .widget {
          --widget-bg: #f1f5f2;
          --widget-bubble-bg: #fcfdfc;
          --widget-bubble-border: #d5e0d9;
          --widget-assistant-text: #17241f;
          --widget-assistant-heading: #17241f;
          --widget-assistant-muted: #52635b;
          --widget-code-bg: #e8efeb;
          --widget-code-text: #17241f;
          --widget-human-bg: #dcebe4;
          --widget-human-border: #b6d3c4;
          --widget-human-text: #20382e;
          --widget-system-bg: #e8efeb;
          --widget-system-border: #d5e0d9;
          --widget-system-text: #52635b;
          --widget-input-bg: #fcfdfc;
          --widget-input-border: #c2d0c7;
          --widget-input-text: #17241f;
          --widget-source-bg: #e8efeb;
          --widget-source-text: #17241f;
          --widget-source-label: #52635b;
          --widget-error-bg: #f6e8e5;
          --widget-error-border: #e8c0ba;
          --widget-error-text: #a63f3c;
          --widget-status-bg: #e0efe6;
          --widget-status-border: #b6d3c4;
          --widget-status-text: #256f51;
        }
        :root.dark .widget,
        .dark .widget,
        .widget.dark {
          --widget-bg: #0e1714;
          --widget-bubble-bg: #15211c;
          --widget-bubble-border: #304139;
          --widget-assistant-text: #e7f0ea;
          --widget-assistant-heading: #fcfdfc;
          --widget-assistant-muted: #a8bbb0;
          --widget-code-bg: #1b2b24;
          --widget-code-text: #e7f0ea;
          --widget-human-bg: #203d31;
          --widget-human-border: #355b49;
          --widget-human-text: #dcebe4;
          --widget-system-bg: #15211c;
          --widget-system-border: #304139;
          --widget-system-text: #a8bbb0;
          --widget-input-bg: #15211c;
          --widget-input-border: #304139;
          --widget-input-text: #e7f0ea;
          --widget-source-bg: #1b2b24;
          --widget-source-text: #e7f0ea;
          --widget-source-label: #a8bbb0;
          --widget-error-bg: #432522;
          --widget-error-border: #6c3933;
          --widget-error-text: #f09a91;
          --widget-status-bg: #193b2a;
          --widget-status-border: #31583f;
          --widget-status-text: #8bcaa3;
        }
        @media (prefers-color-scheme: dark) {
          :root:not(.light) .widget:not(.light) {
            --widget-bg: #0e1714;
            --widget-bubble-bg: #15211c;
            --widget-bubble-border: #304139;
            --widget-assistant-text: #e7f0ea;
            --widget-assistant-heading: #fcfdfc;
            --widget-assistant-muted: #a8bbb0;
            --widget-code-bg: #1b2b24;
            --widget-code-text: #e7f0ea;
            --widget-human-bg: #203d31;
            --widget-human-border: #355b49;
            --widget-human-text: #dcebe4;
            --widget-system-bg: #15211c;
            --widget-system-border: #304139;
            --widget-system-text: #a8bbb0;
            --widget-input-bg: #15211c;
            --widget-input-border: #304139;
            --widget-input-text: #e7f0ea;
            --widget-source-bg: #1b2b24;
            --widget-source-text: #e7f0ea;
            --widget-source-label: #a8bbb0;
            --widget-error-bg: #432522;
            --widget-error-border: #6c3933;
            --widget-error-text: #f09a91;
            --widget-status-bg: #193b2a;
            --widget-status-border: #31583f;
            --widget-status-text: #8bcaa3;
          }
          :root:not(.light) .widget:not(.light) .human-sender { color: #a1d5ba; }
          :root:not(.light) .widget:not(.light) input:focus { outline-color: #92d0b2; }
          :root:not(.light) .widget:not(.light) .widget-markdown a { color: #a1d5ba; }
          :root:not(.light) .widget:not(.light) .handoff-btn { color: #a1d5ba; }
          :root:not(.light) .widget:not(.light) .handoff-compose-note { color: #a8bbb0; }
        }
        :root.dark .widget-markdown a,
        :root.dark .handoff-btn,
        .dark .handoff-btn,
        .dark .widget-markdown a {
          color: #a1d5ba;
        }
        .widget {
          display: flex; flex-direction: column;
          height: 100svh;
          height: 100dvh;
          min-height: 0;
          overflow: hidden;
          color: var(--widget-assistant-text);
          background: var(--widget-bg);
        }
        .header {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          padding-top: max(14px, calc(14px + env(safe-area-inset-top, 0px)));
          color: var(--widget-brand-text); background: var(--widget-brand);
          flex-shrink: 0;
        }
        .header-text { flex: 1; min-width: 0; }
        .name { margin: 0; font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .status { margin: 2px 0 0; font-size: 11px; opacity: 1; }
        .header-actions { display: flex; align-items: center; gap: 8px; }
        .header-btn {
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; min-width: 36px; min-height: 36px;
          border: 1.5px solid rgba(255,255,255,.35); border-radius: 9px;
          background: transparent; color: #fff; cursor: pointer;
          font-size: 16px; line-height: 1;
          transition: background 150ms;
        }
        .header-btn:hover { background: rgba(255,255,255,.15); }
        .header-btn:focus-visible { outline: 3px solid #92d0b2; outline-offset: 2px; }
        .close-btn {
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; min-width: 36px; min-height: 36px;
          border: 1.5px solid rgba(255,255,255,.35); border-radius: 9px;
          background: transparent; color: #fff; cursor: pointer;
          font-size: 18px; line-height: 1;
          transition: background 150ms;
        }
        .close-btn:hover { background: rgba(255,255,255,.15); }
        .close-btn:focus-visible { outline: 3px solid #92d0b2; outline-offset: 2px; }
        .messages {
          flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          padding: 14px;
          background: var(--widget-bg);
        }
        .message {
          max-width: 88%; margin: 0 0 12px;
          padding: 10px 12px; border-radius: 13px;
          overflow-wrap: anywhere; word-break: break-word;
          font-size: 14px; line-height: 1.5;
        }
        .assistant {
          background: var(--widget-bubble-bg);
          border: 1px solid var(--widget-bubble-border);
          color: var(--widget-assistant-text);
        }
        .human {
          background: var(--widget-human-bg);
          border: 1px solid var(--widget-human-border);
          color: var(--widget-human-text);
        }
        .system {
          background: var(--widget-system-bg);
          border: 1px solid var(--widget-system-border);
          color: var(--widget-system-text);
          font-size: 12px;
        }
        .user {
          margin-left: auto;
          white-space: pre-wrap;
          background: var(--widget-brand);
          color: var(--widget-brand-text);
        }
        .sender-label {
          display: flex; align-items: center; gap: 5px; margin: 0 0 4px 4px;
          color: var(--widget-source-label); font-size: 11px; font-weight: 700;
        }
        .human-sender { color: #2e7d5b; }
        :root.dark .human-sender, .dark .human-sender { color: #a1d5ba; }
        .sender-avatar { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; flex-shrink: 0; }
        .widget-markdown {
          min-width: 0;
          overflow-wrap: anywhere;
          word-break: break-word;
          color: var(--widget-assistant-text);
        }
        .widget-markdown > :first-child { margin-top: 0; }
        .widget-markdown > :last-child { margin-bottom: 0; }
        .widget-markdown p {
          margin: .45em 0;
          color: var(--widget-assistant-text) !important;
        }
        .widget-markdown h1, .widget-markdown h2, .widget-markdown h3 {
          margin: .7em 0 .35em;
          line-height: 1.2;
          color: var(--widget-assistant-heading) !important;
        }
        .widget-markdown h1 { font-size: 1.2em; }
        .widget-markdown h2 { font-size: 1.08em; }
        .widget-markdown h3 { font-size: 1em; }
        .widget-markdown strong {
          color: var(--widget-assistant-heading) !important;
          font-weight: 700;
        }
        .widget-markdown ul, .widget-markdown ol {
          margin: .45em 0;
          padding-left: 1.35em;
          color: var(--widget-assistant-text) !important;
        }
        .widget-markdown ul { list-style: disc; }
        .widget-markdown ol { list-style: decimal; }
        .widget-markdown li {
          color: var(--widget-assistant-text) !important;
        }
        .widget-markdown li > p { margin: 0; }
        .widget-markdown blockquote {
          margin: .55em 0;
          padding-left: 10px;
          border-left: 3px solid var(--widget-bubble-border);
          color: var(--widget-assistant-muted) !important;
          font-style: italic;
        }
        .widget-markdown a {
          color: var(--widget-brand-link);
          text-decoration: underline;
          overflow-wrap: anywhere;
        }
        .widget-markdown code {
          padding: .1em .3em;
          border-radius: 4px;
          background: var(--widget-code-bg);
          color: var(--widget-code-text) !important;
          font-size: .88em;
          overflow-wrap: anywhere;
        }
        .widget-markdown pre {
          max-width: 100%;
          overflow-x: auto;
          margin: .55em 0;
          padding: 10px 12px;
          border-radius: 8px;
          background: #202c2a;
        }
        .widget-markdown pre code {
          background: none !important;
          color: #e7f0ea !important;
          font-size: .85em;
        }
        .sources {
          margin: -4px 0 12px; padding: 0 4px;
          color: var(--widget-source-label); font-size: 11px;
          display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: center;
        }
        .sources strong { flex-shrink: 0; }
        .source {
          display: inline-block; padding: 2px 7px; border-radius: 5px;
          background: var(--widget-source-bg); color: var(--widget-source-text);
          white-space: nowrap;
          max-width: min(160px, 45vw); overflow: hidden; text-overflow: ellipsis;
        }
        .error {
          flex-shrink: 0;
          padding: 8px 14px;
          color: var(--widget-error-text);
          background: var(--widget-error-bg);
          font-size: 12px;
          border-top: 1px solid var(--widget-error-border);
        }
        .status-banner {
          flex-shrink: 0;
          padding: 8px 14px;
          color: var(--widget-status-text);
          background: var(--widget-status-bg);
          border-top: 1px solid var(--widget-status-border);
          font-size: 12px;
        }
        .restore-status { display: flex; align-items: center; gap: 6px; padding: 18px 4px; color: var(--widget-source-label); font-size: 13px; }
        .restore-status .typing-dot { width: 6px; height: 6px; border-radius: 50%; background: #6c8178; animation: supportai-dot 1.2s ease-in-out infinite; }
        .restore-status .typing-dot:nth-child(2) { animation-delay: .16s; } .restore-status .typing-dot:nth-child(3) { animation-delay: .32s; }
        .restore-error { flex-shrink: 0; display: flex; flex-direction: column; gap: 8px; padding: 10px 14px; font-size: 12px; color: var(--widget-error-text); background: var(--widget-error-bg); border-top: 1px solid var(--widget-error-border); }
        .restore-actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .restore-actions button { min-height: 32px; padding: 0 12px; border: 1px solid currentColor; border-radius: 8px; background: transparent; color: inherit; font: inherit; font-weight: 600; cursor: pointer; }
        .restore-actions button:focus-visible { outline: 3px solid #92d0b2; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .restore-status .typing-dot { animation: none; opacity: .75; } }
        .handoff-compose-note {
          flex-shrink: 0;
          padding: 8px 14px 4px;
          margin: 0;
          white-space: normal;
          overflow-wrap: break-word;
          word-break: break-word;
          color: var(--widget-source-label);
          background: var(--widget-bubble-bg);
          font-size: 12px; line-height: 1.4;
        }
        form {
          display: flex; gap: 8px;
          padding: 10px 12px;
          padding-bottom: max(10px, calc(10px + env(safe-area-inset-bottom, 0px)));
          border-top: 1px solid var(--widget-bubble-border);
          background: var(--widget-bubble-bg);
          flex-shrink: 0;
        }
        input {
          min-width: 0; flex: 1;
          padding: 10px 12px;
          border: 1px solid var(--widget-input-border);
          border-radius: 10px;
          color: var(--widget-input-text);
          background: var(--widget-input-bg);
          font: inherit;
          /* 16px prevents iOS Safari auto-zoom on focus */
          font-size: 16px;
          -webkit-appearance: none;
        }
        input:focus { outline: 3px solid #17241f; outline-offset: -1px; border-color: var(--widget-brand); }
        :root.dark input:focus, .dark input:focus { outline-color: #92d0b2; }
        input:disabled { opacity: .7; cursor: not-allowed; }
        button[type=submit] {
          flex-shrink: 0;
          border: 0; border-radius: 10px;
          padding: 0 16px;
          min-height: 44px; min-width: 56px;
          background: var(--widget-brand); color: var(--widget-brand-text);
          cursor: pointer; font-weight: 600; font-size: 14px;
          -webkit-appearance: none;
        }
        button[type=submit]:disabled { cursor: wait; opacity: .55; }
        button[type=submit]:focus-visible { outline: 3px solid #92d0b2; outline-offset: 2px; }
        .typing { display: flex; align-items: center; gap: 5px; min-height: 36px; width: max-content; color: var(--widget-source-label); }
        .typing-dot { width: 6px; height: 6px; border-radius: 50%; background: #6c8178; animation: supportai-dot 1.2s ease-in-out infinite; }
        .typing-dot:nth-child(2) { animation-delay: .16s; } .typing-dot:nth-child(3) { animation-delay: .32s; }
        @keyframes supportai-dot { 0%, 60%, 100% { opacity: .35; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
        @media (prefers-reduced-motion: reduce) { .typing-dot { animation: none; opacity: .75; } }
        .handoff-btn {
          flex-shrink: 0; width: 100%; border: 0;
          border-top: 1px solid var(--widget-bubble-border);
          padding: 10px 14px;
          background: var(--widget-bubble-bg);
          color: var(--widget-brand-link);
          cursor: pointer;
          font: 600 13px var(--font-geist-sans, ui-sans-serif, system-ui, sans-serif); text-align: left;
        }
        .handoff-btn:focus-visible, .handoff-actions button:focus-visible {
          outline: 3px solid #92d0b2; outline-offset: -2px;
        }
        .handoff-form {
          display: flex; flex-direction: column; gap: 8px; padding: 12px;
          border-top: 1px solid var(--widget-bubble-border);
          background: var(--widget-bubble-bg);
          color: var(--widget-input-text);
          flex-shrink: 0;
          font-size: 13px;
        }
        .handoff-form input, .handoff-form textarea {
          width: 100%; min-width: 0; padding: 8px 10px;
          border: 1px solid var(--widget-input-border);
          border-radius: 8px;
          color: var(--widget-input-text);
          background: var(--widget-input-bg);
          font: inherit;
        }
        .handoff-form textarea { resize: vertical; }
        .handoff-actions { display: flex; gap: 8px; }
        .handoff-actions button {
          min-height: 38px; padding: 0 12px; border: 0; border-radius: 8px;
          background: var(--widget-brand); color: var(--widget-brand-text); cursor: pointer; font-weight: 600;
        }
        .handoff-actions button:last-child {
          background: var(--widget-source-bg);
          color: var(--widget-source-text);
        }
                .handoff-actions button:disabled { opacity: .55; cursor: wait; }
        .theme-btn {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .theme-btn svg {
          stroke: currentColor;
          display: block;
        }
        .escalation-prompt {
          margin: 6px 0 12px;
          padding: 10px 14px;
          border-radius: 10px;
          background: var(--widget-bubble-bg);
          border: 1px dashed var(--widget-bubble-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-size: 13px;
        }
        .escalation-prompt-text {
          color: var(--widget-assistant-muted);
          line-height: 1.4;
          font-weight: 500;
        }
        .escalation-prompt-btn {
          flex-shrink: 0;
          border: 1px solid var(--widget-brand-link);
          background: transparent;
          color: var(--widget-brand-link);
          border-radius: 7px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 150ms, color 150ms, border-color 150ms;
        }
        .escalation-prompt-btn:hover {
          background: var(--widget-brand);
          color: var(--widget-brand-text);
          border-color: var(--widget-brand);
        }
        .contact-trigger-row {
          display: flex;
          align-items: center;
          padding: 8px 14px;
          border-top: 1px solid var(--widget-bubble-border);
          background: var(--widget-bubble-bg);
          flex-shrink: 0;
        }
        .contact-trigger-btn {
          background: none;
          border: none;
          padding: 0;
          color: var(--widget-brand-link);
          font: 600 13px var(--font-geist-sans, ui-sans-serif, system-ui, sans-serif);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .contact-trigger-btn:hover {
          text-decoration: underline;
        }
        .contact-trigger-btn:focus-visible {
          outline: 3px solid #92d0b2;
          outline-offset: 2px;
          border-radius: 4px;
        }
        .unified-contact-form {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px 14px;
          border-top: 1px solid var(--widget-bubble-border);
          background: var(--widget-bubble-bg);
          color: var(--widget-input-text);
          flex-shrink: 0;
          font-size: 13px;
          max-height: 58vh;
          overflow-y: auto;
        }
        .unified-contact-form strong {
          font-size: 14px;
          font-weight: 700;
          color: var(--widget-assistant-heading);
        }
        .unified-contact-form p {
          margin: 0;
          font-size: 12px;
          color: var(--widget-assistant-muted);
          line-height: 1.35;
        }
        .unified-contact-form label {
          display: flex;
          flex-direction: column;
          gap: 3px;
          font-weight: 600;
          font-size: 12px;
          color: var(--widget-assistant-text);
        }
        .unified-contact-form input,
        .unified-contact-form textarea {
          width: 100%;
          min-width: 0;
          padding: 7px 10px;
          border: 1px solid var(--widget-input-border);
          border-radius: 8px;
          color: var(--widget-input-text);
          background: var(--widget-input-bg);
          font: inherit;
          font-size: 13px;
        }
        .unified-contact-form textarea {
          min-height: 54px;
          resize: vertical;
        }
        .unified-contact-form input:focus,
        .unified-contact-form textarea:focus {
          outline: 2px solid var(--widget-brand);
          outline-offset: -1px;
        }
        .unified-contact-actions {
          display: flex;
          gap: 8px;
          margin-top: 2px;
        }
        .unified-contact-actions button {
          min-height: 38px;
          padding: 0 14px;
          border: 0;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: opacity 150ms;
        }
        .unified-contact-actions button[type="submit"] {
          background: var(--widget-brand);
          color: var(--widget-brand-text);
        }
        .unified-contact-actions button[type="button"] {
          background: var(--widget-source-bg);
          color: var(--widget-source-text);
        }
        .unified-contact-actions button:disabled {
          opacity: 0.55;
          cursor: wait;
        }
        .lead-form { max-height: 42vh; overflow-y: auto; }
        .lead-form label { display: flex; flex-direction: column; gap: 4px; font-weight: 600; }
        .lead-form input, .lead-form textarea { font-weight: 400; }
        .lead-form textarea { min-height: 72px; resize: vertical; }
      `}</style>
      <header className="header">
        <div className="header-text">
          <p className="name">{assistantName}</p>
          <p className="status">Ask us a question</p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="header-btn"
            title="Start new conversation"
            aria-label="Start new conversation"
            onClick={resetLocalSession}
          >
            ↻
          </button>
          <button
            type="button"
            className="header-btn theme-btn"
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="close-btn"
            aria-label="Close chat"
            onClick={() => postToParent({ type: "supportai:close" })}
          >
            ✕
          </button>
        </div>
      </header>
      <div className="messages" ref={messagesRef} aria-live="polite">
        {restoreState === "loading" ? (
          <div className="restore-status" role="status" aria-live="polite">
            <span className="typing-dot" aria-hidden="true" /><span className="typing-dot" aria-hidden="true" /><span className="typing-dot" aria-hidden="true" />
            <span>Restoring your conversation…</span>
          </div>
        ) : restoreState === "failed" ? null : messages.map((item, index) => (
          <div key={`${item.role}-${index}`}>
            {item.role !== "user" && (
              <div className={`sender-label ${item.role === "human" ? "human-sender" : "ai-sender"}`}>
                <span className="sender-avatar" aria-hidden="true">
                  {item.role === "human" ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  ) : item.role === "system" ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-9.5A7.5 7.5 0 0 1 10.5 4h2A7.5 7.5 0 0 1 20 11.5Z" /><path d="M8 12h8M8 15h5" /></svg>
                  )}
                </span>
                {item.role === "human" ? "Human Support" : item.role === "system" ? "SupportAI update" : "AI Assistant"}
              </div>
            )}
            <div className={`message ${item.role}`}>
              {item.role === "assistant" || item.role === "human" || item.role === "system" ? (
                <div className="widget-markdown">
                  <MessageContent content={item.content} />
                </div>
              ) : item.content}
            </div>
            {item.role === "assistant" && item.sources && item.sources.length > 0 && (
              <div className="sources">
                <strong>Sources: </strong>
                {item.sources.map((source, sourceIndex) => (
                  <span className="source" key={`${source.label}-${sourceIndex}`}>
                    {source.label}
                  </span>
                ))}
              </div>
            )}
            {item.role === "assistant" && item.requestId && escalatedTurnId === item.requestId && !showContactForm && (
              <div className="escalation-prompt" role="region" aria-label="Support team recommendation">
                <span className="escalation-prompt-text">
                  Would you like our human team to follow up on this?
                </span>
                <button
                  type="button"
                  className="escalation-prompt-btn"
                  onClick={() => {
                    const lastUser = [...messages].reverse().find((m) => m.role === "user");
                    if (lastUser && !contactMessage) {
                      setContactMessage(lastUser.content.slice(0, 2000));
                    }
                    setContactNotice("");
                    setShowContactForm(true);
                  }}
                >
                  Talk to our team →
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && !streamingStarted && (
          <div className="message assistant typing" role="status" aria-label="Assistant is thinking" aria-live="polite">
            <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
          </div>
        )}
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      {restoreState === "failed" && (
        <div className="restore-error" role="alert">
          <span>We couldn’t load your previous conversation.</span>
          <div className="restore-actions">
            <button type="button" onClick={requestRestore}>Try again</button>
            <button type="button" onClick={resetLocalSession}>Start a new conversation</button>
          </div>
        </div>
      )}
      {restoreNotice && restoreState === "ready" && <div className="status-banner" role="status">{restoreNotice}</div>}
      {visibleHandoffNotice && <div className="status-banner" role="status">{visibleHandoffNotice}</div>}
      {leadNotice && <div className="status-banner" role={leadNotice.startsWith("Thanks!") ? "status" : "alert"}>{leadNotice}</div>}
      {handoffAccess && !handoffPollUnavailable && (
        <p className="handoff-compose-note" role="note">
          Messaging is paused while this human support request is active. You can continue chatting after the request is resolved.
        </p>
      )}
      {handoffAccess && (
        <button
          type="button"
          id="supportai-reset-session"
          className="handoff-btn"
          style={{ color: "var(--widget-source-label)", fontSize: "12px" }}
          onClick={resetLocalSession}
        >
          Start new conversation
        </button>
      )}
      {!handoffAccess && !showContactForm && (
        <div className="contact-trigger-row">
          <button
            type="button"
            className="contact-trigger-btn"
            onClick={() => {
              const lastUser = [...messages].reverse().find((item) => item.role === "user");
              if (lastUser && !contactMessage) {
                setContactMessage(lastUser.content.slice(0, 2000));
              }
              setContactNotice("");
              setShowContactForm(true);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Talk to our team
          </button>
        </div>
      )}
      {showContactForm && !handoffAccess && (
        <form className="unified-contact-form" onSubmit={submitContactSupport}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>Talk to our team</strong>
            <button
              type="button"
              onClick={() => setShowContactForm(false)}
              style={{ background: "none", border: "none", color: "var(--widget-assistant-muted)", cursor: "pointer", fontSize: "16px", padding: "2px 6px" }}
              aria-label="Back to chat"
            >
              ✕
            </button>
          </div>
          <p>{handoffIntro || "Leave a note and your email. Our team will review your question and get back to you."}</p>
          <label>
            Your name
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              maxLength={120}
              placeholder="Jane Doe (optional)"
              autoComplete="name"
            />
          </label>
          <label>
            Your email <span style={{ color: "var(--widget-error-text)" }}>*</span>
            <input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              maxLength={254}
              type="email"
              placeholder="jane@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Message <span style={{ color: "var(--widget-error-text)" }}>*</span>
            <textarea
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="How can our team help?"
              required
            />
          </label>
          {contactNotice && (
            <div className="status-banner" style={{ margin: "2px 0", borderRadius: "6px" }} role="alert">
              {contactNotice}
            </div>
          )}
          <div className="unified-contact-actions">
            <button type="submit" disabled={contactSubmitting}>
              {contactSubmitting ? "Sending…" : "Send message"}
            </button>
            <button type="button" disabled={contactSubmitting} onClick={() => setShowContactForm(false)}>
              Back to chat
            </button>
          </div>
        </form>
      )}
      {!showContactForm && (
        <form onSubmit={submit}>
        <input
          ref={inputRef}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          aria-label="Message"
          autoComplete="off"
          maxLength={WIDGET_MAX_MESSAGE_LENGTH}
          placeholder="Type your question…"
          disabled={loading || Boolean(handoffAccess) || restoreState !== "ready"}
        />
        <button type="submit" disabled={!canSubmitWidgetMessage(message, {
          loading,
          handoffActive: Boolean(handoffAccess),
          assistantReady: Boolean(assistantId),
          submissionPending: restoreState !== "ready",
        })}>Send</button>
      </form>
      )}
    </main>
  );
}
