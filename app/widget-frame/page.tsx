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
  const [showHandoffForm, setShowHandoffForm] = useState(false);
  const [handoffName, setHandoffName] = useState("");
  const [handoffEmail, setHandoffEmail] = useState("");
  const [handoffReason, setHandoffReason] = useState("The customer requested help from a human.");
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadQuestion, setLeadQuestion] = useState("");
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadNotice, setLeadNotice] = useState("");
  const leadSendingRef = useRef(false);
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
    (handoffAccess ? "You're now chatting with a human support agent." : "");
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
    setLocalHandoffAccess(null);
    setHandoffPollUnavailable(false);
    setHandoffNotice("");
    setShowHandoffForm(false);
    setSeenHumanMessages([]);
    setConversationId("");
    setMessages([{ role: "assistant", content: welcomeMessage }]);
  }, [welcomeMessage]);
  const resetLocalSession = useCallback(() => {
    postToParent({ type: "supportai:rotate-visitor-session" });
    clearLocalSession();
  }, [clearLocalSession, postToParent]);

  useEffect(() => {
    const receiveMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== parentOrigin) return;
      if (event.data?.type === "supportai:restore-response" && event.data.ok === true) {
        const payload = event.data.payload as { conversation_id?: unknown; messages?: unknown };
        if (typeof payload.conversation_id === "string" && Array.isArray(payload.messages)) {
          const restored = payload.messages.flatMap((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) return [];
            const row = item as Record<string, unknown>;
            if ((row.role !== "user" && row.role !== "assistant") || typeof row.content !== "string") return [];
            const sources = Array.isArray(row.sources) ? row.sources.flatMap((source) =>
              source && typeof source === "object" && !Array.isArray(source) && typeof (source as { label?: unknown }).label === "string"
                ? [{ label: (source as { label: string }).label }]
                : [],
            ) : [];
            return [{ role: row.role, content: row.content, sources } as ChatMessage];
          });
          if (restored.length) {
            setConversationId(payload.conversation_id);
            setMessages([{ role: "assistant", content: welcomeMessage }, ...restored]);
          }
        }
      } else if (event.data?.type === "supportai:brand-config") {
        const nextColor = normalizeBrandColor(event.data.brand_color);
        if (nextColor) setBrandColor(nextColor);
      } else if (event.data?.type === "supportai:reset-session") {
        clearLocalSession();
      }
    };
    window.addEventListener("message", receiveMessage);
    postToParent({ type: "supportai:ready" });
    if (!restoreRequestedRef.current) {
      restoreRequestedRef.current = true;
      postToParent({ type: "supportai:restore-request", requestId: crypto.randomUUID(), assistantId });
    }
    return () => window.removeEventListener("message", receiveMessage);
  }, [assistantId, clearLocalSession, parentOrigin, postToParent, welcomeMessage]);
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
      if (payload.handoff_available === true ||
        payload.response === "I’m sorry, I don’t have enough information in my knowledge base to answer that question.") {
        setShowHandoffForm(true);
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

  const submitHandoff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (handoffLoading || !handoffReason.trim()) return;
    if (handoffEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handoffEmail.trim())) {
      setHandoffNotice("Please enter a valid email address or leave it blank.");
      return;
    }
    setHandoffLoading(true);
    setHandoffNotice("");
    try {
      const requestId = crypto.randomUUID();
      debugWidget("handoff-send", { requestId, hasParentOrigin: parentOrigin ? 1 : 0 });
      const payload = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          window.removeEventListener("message", onMessage);
          reject(new Error("The handoff request timed out."));
        }, WIDGET_REQUEST_TIMEOUT_MS + 1000);
        function onMessage(event: MessageEvent) {
          if (!isTrustedWidgetMessage(event.source, window.parent, event.origin, parentOrigin) ||
            event.data?.type !== "supportai:handoff-response" ||
            event.data.requestId !== requestId) return;
          debugWidget("handoff-response-received", { requestId, ok: event.data.ok ? 1 : 0 });
          window.clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          if (!event.data.ok) reject(new Error("Unable to submit your request right now."));
          else resolve(event.data.payload as Record<string, unknown>);
        }
        window.addEventListener("message", onMessage);
        postToParent({
          type: "supportai:handoff-request",
          requestId,
          assistantId,
          customerName: handoffName.trim() || undefined,
          customerEmail: handoffEmail.trim() || undefined,
          reason: handoffReason.trim(),
          conversationId,
          transcript: messages.slice(-50).map(({ role, content }) => ({ role, content })),
        });
      });
      if (typeof payload.handoff_id !== "string" || typeof payload.access_token !== "string") {
        throw new Error("Unable to submit your request right now.");
      }
      const access = { id: payload.handoff_id, token: payload.access_token };
      setLocalHandoffAccess(access);
      saveHandoffAccess(assistantId, access, localStorage);
      setHandoffPollUnavailable(false);
      setHandoffNotice("You're now chatting with a human support agent.");
      setShowHandoffForm(false);
    } catch (handoffError) {
      setHandoffNotice(handoffError instanceof Error ? handoffError.message : "Unable to submit your request right now.");
    } finally {
      setHandoffLoading(false);
    }
  };

  const submitLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (leadSendingRef.current || !assistantId) return;
    const cleanName = leadName.trim();
    const cleanEmail = leadEmail.trim();
    const cleanQuestion = leadQuestion.trim();
    if (!cleanName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || !cleanQuestion) {
      setLeadNotice("Please enter your name, a valid email, and your question.");
      return;
    }

    leadSendingRef.current = true;
    setLeadLoading(true);
    setLeadNotice("");
    const requestId = crypto.randomUUID();
    try {
      const result = await new Promise<{ success?: boolean; message?: string }>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          window.removeEventListener("message", onMessage);
          reject(new Error("Lead submission is temporarily unavailable. Please try again."));
        }, WIDGET_REQUEST_TIMEOUT_MS + 1000);
        function onMessage(event: MessageEvent) {
          if (!isTrustedWidgetMessage(event.source, window.parent, event.origin, parentOrigin) ||
            event.data?.type !== "supportai:lead-response" || event.data.requestId !== requestId) return;
          window.clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          if (event.data.ok === true && event.data.payload && typeof event.data.payload === "object") {
            resolve(event.data.payload as { success?: boolean; message?: string });
          } else {
            reject(new Error(typeof event.data.error === "string" ? event.data.error : "Lead submission is temporarily unavailable. Please try again."));
          }
        }
        window.addEventListener("message", onMessage);
        postToParent({
          type: "supportai:lead-request",
          requestId,
          assistantId,
          name: cleanName,
          email: cleanEmail,
          question: cleanQuestion,
        });
      });
      if (result.success !== true) throw new Error("Lead submission is temporarily unavailable. Please try again.");
      setLeadNotice("Thanks! Your details were submitted successfully.");
      setLeadName("");
      setLeadEmail("");
      setLeadQuestion("");
      setShowLeadForm(false);
    } catch (submitError) {
      setLeadNotice(submitError instanceof Error ? submitError.message : "Lead submission is temporarily unavailable. Please try again.");
    } finally {
      leadSendingRef.current = false;
      setLeadLoading(false);
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
      className="widget"
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
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          /* Prevent rubber-band scroll on the host page when iframe is focused */
          overscroll-behavior: none;
        }
        :root, .widget {
          --widget-bg: #f7f7f4;
          --widget-bubble-bg: #ffffff;
          --widget-bubble-border: #e4e7e2;
          --widget-assistant-text: #1e293b;
          --widget-assistant-heading: #0f172a;
          --widget-assistant-muted: #475569;
          --widget-code-bg: #eef1ed;
          --widget-code-text: #1e293b;
          --widget-human-bg: #e4f2ec;
          --widget-human-border: #b8d8ca;
          --widget-human-text: #1e3a2f;
          --widget-system-bg: #eef3f1;
          --widget-system-border: #d7e2dd;
          --widget-system-text: #3f4e48;
          --widget-input-bg: #ffffff;
          --widget-input-border: #cbd4cc;
          --widget-input-text: #1e293b;
          --widget-source-bg: #e8ece7;
          --widget-source-text: #1e293b;
          --widget-source-label: #475569;
          --widget-error-bg: #fceded;
          --widget-error-border: #edc4c4;
          --widget-error-text: #9e3f3f;
          --widget-status-bg: #e7f4ed;
          --widget-status-border: #b8d8ca;
          --widget-status-text: #276847;
        }
        :root.dark .widget,
        .dark .widget {
          --widget-bg: #171b1a;
          --widget-bubble-bg: #222826;
          --widget-bubble-border: #343d39;
          --widget-assistant-text: #f1f3f0;
          --widget-assistant-heading: #ffffff;
          --widget-assistant-muted: #adb8b2;
          --widget-code-bg: #2b3330;
          --widget-code-text: #f1f3f0;
          --widget-human-bg: #1d362e;
          --widget-human-border: #2d5548;
          --widget-human-text: #e4f2ec;
          --widget-system-bg: #1d2321;
          --widget-system-border: #2e3834;
          --widget-system-text: #adb8b2;
          --widget-input-bg: #1d2321;
          --widget-input-border: #343d39;
          --widget-input-text: #f1f3f0;
          --widget-source-bg: #2b3330;
          --widget-source-text: #f1f3f0;
          --widget-source-label: #adb8b2;
          --widget-error-bg: #2d1818;
          --widget-error-border: #5c2424;
          --widget-error-text: #fca5a5;
          --widget-status-bg: #132b21;
          --widget-status-border: #1e4a37;
          --widget-status-text: #86efac;
        }
        @media (prefers-color-scheme: dark) {
          :root:not(.light) .widget {
            --widget-bg: #171b1a;
            --widget-bubble-bg: #222826;
            --widget-bubble-border: #343d39;
            --widget-assistant-text: #f1f3f0;
            --widget-assistant-heading: #ffffff;
            --widget-assistant-muted: #adb8b2;
            --widget-code-bg: #2b3330;
            --widget-code-text: #f1f3f0;
            --widget-human-bg: #1d362e;
            --widget-human-border: #2d5548;
            --widget-human-text: #e4f2ec;
            --widget-system-bg: #1d2321;
            --widget-system-border: #2e3834;
            --widget-system-text: #adb8b2;
            --widget-input-bg: #1d2321;
            --widget-input-border: #343d39;
            --widget-input-text: #f1f3f0;
            --widget-source-bg: #2b3330;
            --widget-source-text: #f1f3f0;
            --widget-source-label: #adb8b2;
            --widget-error-bg: #2d1818;
            --widget-error-border: #5c2424;
            --widget-error-text: #fca5a5;
            --widget-status-bg: #132b21;
            --widget-status-border: #1e4a37;
            --widget-status-text: #86efac;
          }
          :root:not(.light) .human-sender { color: #79b995; }
          :root:not(.light) input:focus { outline-color: #78b6a0; }
          :root:not(.light) .widget-markdown a { color: #5eead4; }
        }
        :root.dark .widget-markdown a,
        .dark .widget-markdown a {
          color: #5eead4;
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
        .header-btn:focus-visible { outline: 3px solid #78b6a0; outline-offset: 2px; }
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
        .close-btn:focus-visible { outline: 3px solid #78b6a0; outline-offset: 2px; }
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
        :root.dark .human-sender, .dark .human-sender { color: #79b995; }
        .sender-avatar { font-size: 13px; line-height: 1; }
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
          color: #f1f3f0 !important;
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
        .handoff-compose-note {
          flex-shrink: 0; padding: 7px 12px 0;
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
        input:focus { outline: 3px solid #0f172a; outline-offset: -1px; border-color: var(--widget-brand); }
        :root.dark input:focus, .dark input:focus { outline-color: #78b6a0; }
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
        button[type=submit]:focus-visible { outline: 3px solid #78b6a0; outline-offset: 2px; }
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
          font: 600 13px system-ui, sans-serif; text-align: left;
        }
        .handoff-btn:focus-visible, .handoff-actions button:focus-visible {
          outline: 3px solid #78b6a0; outline-offset: -2px;
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
            className="close-btn"
            aria-label="Close chat"
            onClick={() => postToParent({ type: "supportai:close" })}
          >
            ✕
          </button>
        </div>
      </header>
      <div className="messages" ref={messagesRef} aria-live="polite">
        {messages.map((item, index) => (
          <div key={`${item.role}-${index}`}>
            {item.role !== "user" && (
              <div className={`sender-label ${item.role === "human" ? "human-sender" : "ai-sender"}`}>
                <span className="sender-avatar" aria-hidden="true">{item.role === "human" ? "👤" : item.role === "system" ? "ℹ️" : "🤖"}</span>
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
          </div>
        ))}
        {loading && !streamingStarted && (
          <div className="message assistant typing" role="status" aria-label="Assistant is thinking" aria-live="polite">
            <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
          </div>
        )}
      </div>
      {error && <div className="error" role="alert">{error}</div>}
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
          style={{ color: "#69736f", fontSize: "12px" }}
          onClick={resetLocalSession}
        >
          Start new conversation
        </button>
      )}
      {!handoffAccess && !showHandoffForm && !showLeadForm && (
        <button type="button" className="handoff-btn" onClick={() => setShowHandoffForm(true)}>
          Talk to a human
        </button>
      )}
      {!handoffAccess && !showLeadForm && !showHandoffForm && (
        <button type="button" className="handoff-btn" onClick={() => {
          setLeadQuestion(([...messages].reverse().find((item) => item.role === "user")?.content ?? "").slice(0, 5000));
          setLeadNotice("");
          setShowLeadForm(true);
        }}>
          Leave your details
        </button>
      )}
      {showLeadForm && !handoffAccess && (
        <form className="handoff-form lead-form" onSubmit={submitLead}>
          <strong>Request a follow-up</strong>
          <label>Name<input value={leadName} onChange={(event) => setLeadName(event.target.value)} maxLength={120} autoComplete="name" required /></label>
          <label>Email<input value={leadEmail} onChange={(event) => setLeadEmail(event.target.value)} maxLength={254} type="email" autoComplete="email" required /></label>
          <label>Your question<textarea value={leadQuestion} onChange={(event) => setLeadQuestion(event.target.value)} maxLength={5000} required /></label>
          <div className="handoff-actions">
            <button type="submit" disabled={leadLoading}>{leadLoading ? "Submitting…" : "Submit details"}</button>
            <button type="button" disabled={leadLoading} onClick={() => setShowLeadForm(false)}>Cancel</button>
          </div>
        </form>
      )}
      {showHandoffForm && !handoffAccess && (
        <form className="handoff-form" onSubmit={submitHandoff}>
          <strong>Talk to a human</strong>
          <input value={handoffName} onChange={(event) => setHandoffName(event.target.value)} maxLength={120} placeholder="Your name (optional)" />
          <input value={handoffEmail} onChange={(event) => setHandoffEmail(event.target.value)} maxLength={254} type="email" placeholder="Your email (optional)" />
          <textarea value={handoffReason} onChange={(event) => setHandoffReason(event.target.value)} maxLength={2000} rows={3} aria-label="Reason for contacting a human" />
          <div className="handoff-actions">
            <button type="submit" disabled={handoffLoading}>{handoffLoading ? "Submitting…" : "Submit request"}</button>
            <button type="button" onClick={() => setShowHandoffForm(false)}>Cancel</button>
          </div>
        </form>
      )}
      <form onSubmit={submit}>
        <input
          ref={inputRef}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          aria-label="Message"
          autoComplete="off"
          maxLength={WIDGET_MAX_MESSAGE_LENGTH}
          placeholder="Type your question…"
          disabled={loading || Boolean(handoffAccess)}
        />
        <button type="submit" disabled={!canSubmitWidgetMessage(message, {
          loading,
          handoffActive: Boolean(handoffAccess),
          assistantReady: Boolean(assistantId),
          submissionPending: false,
        })}>Send</button>
      </form>
    </main>
  );
}
