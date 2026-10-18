"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import {
  formatRateLimitMessage,
  classifyWidgetSender,
  isWidgetChatResponse,
  isTrustedWidgetMessage,
  WIDGET_MAX_MESSAGE_LENGTH,
  WIDGET_REQUEST_TIMEOUT_MS,
  resolveWidgetParentOrigin,
} from "@/lib/widget-protocol";

type Source = { label: string };
type ChatMessage = {
  role: "user" | "assistant" | "human";
  content: string;
  sources?: Source[];
  timestamp?: string;
};
type HandoffMessage = { id: string; role: "human"; content: string; created_at?: string };

const FALLBACK_WELCOME = "Hello! How can I help you today?";
const HANDOFF_ACCESS_STORAGE_KEY = "supportai:handoff-access";
type HandoffAccess = { id: string; token: string };

function readSavedHandoffAccess(assistantId: string): HandoffAccess | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(localStorage.getItem(HANDOFF_ACCESS_STORAGE_KEY) ?? "null") as {
      assistantId?: unknown;
      id?: unknown;
      token?: unknown;
    } | null;
    return saved?.assistantId === assistantId &&
      typeof saved.id === "string" &&
      typeof saved.token === "string"
      ? { id: saved.id, token: saved.token }
      : null;
  } catch {
    localStorage.removeItem(HANDOFF_ACCESS_STORAGE_KEY);
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
  const [welcomeMessage, setWelcomeMessage] = useState(FALLBACK_WELCOME);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: FALLBACK_WELCOME },
  ]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHandoffForm, setShowHandoffForm] = useState(false);
  const [handoffName, setHandoffName] = useState("");
  const [handoffEmail, setHandoffEmail] = useState("");
  const [handoffReason, setHandoffReason] = useState("The customer requested help from a human.");
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffAccess, setHandoffAccess] = useState<HandoffAccess | null>(() =>
    readSavedHandoffAccess(assistantId),
  );
  const [handoffNotice, setHandoffNotice] = useState(() =>
    readSavedHandoffAccess(assistantId)
      ? "You're now chatting with a human support agent."
      : "",
  );
  const [seenHumanMessages, setSeenHumanMessages] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const parentOrigin = typeof window === "undefined"
    ? ""
    : resolveWidgetParentOrigin(window.location.search, document.referrer);
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
    if (!cleanMessage || loading || !assistantId) return;

    setMessages((current) => [...current, { role: "user", content: cleanMessage }]);
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const requestId = crypto.randomUUID();
      debugWidget("chat-send", { requestId, hasParentOrigin: parentOrigin ? 1 : 0 });
      const payload = await new Promise<{
        assistant_name?: string;
        welcome_message?: string;
        response?: string;
        handoff_available?: boolean;
        sources?: Source[];
      }>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          window.removeEventListener("message", onMessage);
          reject(new Error("The SupportAI request timed out."));
        }, WIDGET_REQUEST_TIMEOUT_MS + 1000);

        function onMessage(event: MessageEvent) {
          if (
            !isTrustedWidgetMessage(event.source, window.parent, event.origin, parentOrigin) ||
            !isWidgetChatResponse(event.data) ||
            event.data.requestId !== requestId
          ) return;

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
            handoff_available?: boolean;
            sources?: Source[];
          });
        }

        window.addEventListener("message", onMessage);
        window.parent.postMessage(
          {
            type: "supportai:chat-request",
            requestId,
            assistantId,
            message: cleanMessage,
          },
          parentOrigin,
        );
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
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: payload.response || "I’m sorry, I couldn’t generate a response.",
          sources: Array.isArray(payload.sources)
            ? payload.sources.filter((source): source is Source =>
                Boolean(source && typeof source.label === "string"),
              )
            : [],
        },
      ]);
      if (payload.handoff_available === true ||
        payload.response === "I’m sorry, I don’t have enough information in my knowledge base to answer that question.") {
        setShowHandoffForm(true);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to send your message.");
    } finally {
      setLoading(false);
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
        window.parent.postMessage({
          type: "supportai:handoff-request",
          requestId,
          assistantId,
          customerName: handoffName.trim() || undefined,
          customerEmail: handoffEmail.trim() || undefined,
          reason: handoffReason.trim(),
          transcript: messages.slice(-50).map(({ role, content }) => ({ role, content })),
        }, parentOrigin);
      });
      if (typeof payload.handoff_id !== "string" || typeof payload.access_token !== "string") {
        throw new Error("Unable to submit your request right now.");
      }
      const access = { id: payload.handoff_id, token: payload.access_token };
      setHandoffAccess(access);
      localStorage.setItem(
        HANDOFF_ACCESS_STORAGE_KEY,
        JSON.stringify({ assistantId, ...access }),
      );
      setHandoffNotice("You're now chatting with a human support agent.");
      setShowHandoffForm(false);
    } catch (handoffError) {
      setHandoffNotice(handoffError instanceof Error ? handoffError.message : "Unable to submit your request right now.");
    } finally {
      setHandoffLoading(false);
    }
  };

  useEffect(() => {
    if (!handoffAccess) return;
    const poll = () => {
      const requestId = crypto.randomUUID();
      window.parent.postMessage({
        type: "supportai:handoff-poll",
        requestId,
        handoffId: handoffAccess.id,
        accessToken: handoffAccess.token,
      }, parentOrigin);
    };
    const listener = (event: MessageEvent) => {
      if (!isTrustedWidgetMessage(event.source, window.parent, event.origin, parentOrigin) ||
        event.data?.type !== "supportai:handoff-response" || !event.data.ok ||
        !Array.isArray(event.data.payload?.messages)) return;
      if (event.data.payload.status === "resolved") {
        setHandoffAccess(null);
        localStorage.removeItem(HANDOFF_ACCESS_STORAGE_KEY);
        setHandoffNotice("The AI assistant has resumed. You can continue chatting.");
        return;
      }
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
  }, [handoffAccess, parentOrigin, seenHumanMessages]);

  return (
    <main className="widget">
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body { height: 100%; margin: 0; overflow: hidden; }
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          /* Prevent rubber-band scroll on the host page when iframe is focused */
          overscroll-behavior: none;
        }
        .widget {
          display: flex; flex-direction: column;
          height: 100svh;
          height: 100dvh;
          min-height: 0;
          overflow: hidden;
          color: #202c2a; background: #f7f7f4;
        }
        .header {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          padding-top: max(14px, calc(14px + env(safe-area-inset-top, 0px)));
          color: #fff; background: #236b5b;
          flex-shrink: 0;
        }
        .header-text { flex: 1; min-width: 0; }
        .name { margin: 0; font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .status { margin: 2px 0 0; font-size: 11px; opacity: .82; }
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
          background: #f7f7f4;
        }
        .message {
          max-width: 88%; margin: 0 0 12px;
          padding: 10px 12px; border-radius: 13px;
          overflow-wrap: anywhere; word-break: break-word;
          font-size: 14px; line-height: 1.5;
        }
        .assistant { background: #fff; border: 1px solid #e4e7e2; }
        .human { background: #e4f2ec; border: 1px solid #b8d8ca; }
        .user { margin-left: auto; white-space: pre-wrap; background: #236b5b; color: #fff; }
        .sender-label {
          display: flex; align-items: center; gap: 5px; margin: 0 0 4px 4px;
          color: #69736f; font-size: 11px; font-weight: 700;
        }
        .human-sender { color: #2e7d5b; }
        .sender-avatar { font-size: 13px; line-height: 1; }
        .markdown > :first-child { margin-top: 0; }
        .markdown > :last-child { margin-bottom: 0; }
        .markdown p { margin: .55em 0; }
        .markdown h1, .markdown h2, .markdown h3 { margin: .7em 0 .35em; line-height: 1.2; }
        .markdown h1 { font-size: 1.2em; } .markdown h2 { font-size: 1.08em; } .markdown h3 { font-size: 1em; }
        .markdown ul, .markdown ol { margin: .45em 0; padding-left: 1.35em; }
        .markdown li > p { margin: 0; }
        .markdown a { color: #236b5b; text-decoration: underline; overflow-wrap: anywhere; }
        .markdown code { padding: .1em .3em; border-radius: 4px; background: #eef1ed; font-size: .88em; overflow-wrap: anywhere; }
        .markdown pre { overflow-x: auto; margin: .55em 0; padding: 10px 12px; border-radius: 8px; background: #202c2a; }
        .markdown pre code { background: none; color: #f1f3f0; font-size: .85em; }
        .sources {
          margin: -4px 0 12px; padding: 0 4px;
          color: #69736f; font-size: 11px;
          display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: center;
        }
        .sources strong { flex-shrink: 0; }
        .source {
          display: inline-block; padding: 2px 7px; border-radius: 5px;
          background: #e8ece7; white-space: nowrap;
          max-width: min(160px, 45vw); overflow: hidden; text-overflow: ellipsis;
        }
        .error {
          flex-shrink: 0;
          padding: 8px 14px; color: #9e3f3f; background: #fceded;
          font-size: 12px; border-top: 1px solid #edc4c4;
        }
        .status-banner {
          flex-shrink: 0; padding: 8px 14px; color: #276847; background: #e7f4ed;
          border-top: 1px solid #b8d8ca; font-size: 12px;
        }
        form {
          display: flex; gap: 8px;
          padding: 10px 12px;
          padding-bottom: max(10px, calc(10px + env(safe-area-inset-bottom, 0px)));
          border-top: 1px solid #e4e7e2; background: #fff;
          flex-shrink: 0;
        }
        input {
          min-width: 0; flex: 1;
          padding: 10px 12px;
          border: 1px solid #cbd4cc; border-radius: 10px;
          color: #202c2a; background: #fff;
          font: inherit;
          /* 16px prevents iOS Safari auto-zoom on focus */
          font-size: 16px;
          -webkit-appearance: none;
        }
        input:focus { outline: 3px solid #b8d8ca; outline-offset: -1px; border-color: #236b5b; }
        button[type=submit] {
          flex-shrink: 0;
          border: 0; border-radius: 10px;
          padding: 0 16px;
          min-height: 44px; min-width: 56px;
          background: #236b5b; color: #fff;
          cursor: pointer; font-weight: 600; font-size: 14px;
          -webkit-appearance: none;
        }
        button[type=submit]:disabled { cursor: wait; opacity: .55; }
        button[type=submit]:focus-visible { outline: 3px solid #78b6a0; outline-offset: 2px; }
        .typing { color: #69736f; font-style: italic; }
        .handoff-btn {
          flex-shrink: 0; width: 100%; border: 0; border-top: 1px solid #e2e8f0;
          padding: 10px 14px; background: #fff; color: #236b5b; cursor: pointer;
          font: 600 13px system-ui, sans-serif; text-align: left;
        }
        .handoff-btn:focus-visible, .handoff-actions button:focus-visible {
          outline: 3px solid #78b6a0; outline-offset: -2px;
        }
        .handoff-form {
          display: flex; flex-direction: column; gap: 8px; padding: 12px;
          border-top: 1px solid #e4e7e2; background: #fff; flex-shrink: 0;
          font-size: 13px;
        }
        .handoff-form input, .handoff-form textarea {
          width: 100%; min-width: 0; padding: 8px 10px; border: 1px solid #cbd4cc;
          border-radius: 8px; color: #202c2a; background: #fff; font: inherit;
        }
        .handoff-form textarea { resize: vertical; }
        .handoff-actions { display: flex; gap: 8px; }
        .handoff-actions button {
          min-height: 38px; padding: 0 12px; border: 0; border-radius: 8px;
          background: #236b5b; color: white; cursor: pointer; font-weight: 600;
        }
        .handoff-actions button:last-child { background: #e8ece7; color: #3c4742; }
        .handoff-actions button:disabled { opacity: .55; cursor: wait; }
      `}</style>
      <header className="header">
        <div className="header-text">
          <p className="name">{assistantName}</p>
          <p className="status">Ask us a question</p>
        </div>
        <button
          type="button"
          className="close-btn"
          aria-label="Close chat"
          onClick={() => window.parent.postMessage({ type: "supportai:close" }, parentOrigin)}
        >
          ✕
        </button>
      </header>
      <div className="messages" ref={messagesRef} aria-live="polite">
        {messages.map((item, index) => (
          <div key={`${item.role}-${index}`}>
            {item.role !== "user" && (
              <div className={`sender-label ${item.role === "human" ? "human-sender" : "ai-sender"}`}>
                <span className="sender-avatar" aria-hidden="true">{item.role === "human" ? "👤" : "🤖"}</span>
                {item.role === "human" ? "Human Support" : "AI Assistant"}
              </div>
            )}
            <div className={`message ${item.role}`}>
              {item.role === "assistant" || item.role === "human" ? (
                <div className="markdown">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeSanitize]}
                    components={{
                      a: (props) => (
                        <a {...props} target="_blank" rel="noreferrer" />
                      ),
                    }}
                  >
                    {item.content}
                  </ReactMarkdown>
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
        {loading && <div className="message assistant typing">Thinking…</div>}
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      {handoffNotice && <div className="status-banner" role="status">{handoffNotice}</div>}
      {!handoffAccess && !showHandoffForm && (
        <button type="button" className="handoff-btn" onClick={() => setShowHandoffForm(true)}>
          Talk to a human
        </button>
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
        <button type="submit" disabled={loading || Boolean(handoffAccess) || !message.trim()}>Send</button>
      </form>
    </main>
  );
}
