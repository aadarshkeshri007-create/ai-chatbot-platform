"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import {
  formatRateLimitMessage,
  isWidgetChatResponse,
  isTrustedWidgetMessage,
  WIDGET_MAX_MESSAGE_LENGTH,
  WIDGET_REQUEST_TIMEOUT_MS,
} from "@/lib/widget-protocol";

type Source = { label: string };
type ChatMessage = { role: "user" | "assistant"; content: string; sources?: Source[] };

const FALLBACK_WELCOME = "Hello! How can I help you today?";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const appOrigin = typeof window === "undefined" ? "" : window.location.origin;

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
      const payload = await new Promise<{
        assistant_name?: string;
        welcome_message?: string;
        response?: string;
        sources?: Source[];
      }>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          window.removeEventListener("message", onMessage);
          reject(new Error("The SupportAI request timed out."));
        }, WIDGET_REQUEST_TIMEOUT_MS + 1000);

        function onMessage(event: MessageEvent) {
          if (
            !isTrustedWidgetMessage(event.source, window.parent, event.origin, appOrigin) ||
            !isWidgetChatResponse(event.data) ||
            event.data.requestId !== requestId
          ) return;

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
          appOrigin,
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
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to send your message.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

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
          color: #0f172a; background: #fff;
        }
        .header {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          padding-top: max(14px, calc(14px + env(safe-area-inset-top, 0px)));
          color: #fff; background: #1d4ed8;
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
        .close-btn:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
        .messages {
          flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          padding: 14px;
          background: #f8fafc;
        }
        .message {
          max-width: 88%; margin: 0 0 12px;
          padding: 10px 12px; border-radius: 13px;
          overflow-wrap: anywhere; word-break: break-word;
          font-size: 14px; line-height: 1.5;
        }
        .assistant { background: #fff; border: 1px solid #e2e8f0; }
        .user { margin-left: auto; white-space: pre-wrap; background: #2563eb; color: #fff; }
        .markdown > :first-child { margin-top: 0; }
        .markdown > :last-child { margin-bottom: 0; }
        .markdown p { margin: .55em 0; }
        .markdown h1, .markdown h2, .markdown h3 { margin: .7em 0 .35em; line-height: 1.2; }
        .markdown h1 { font-size: 1.2em; } .markdown h2 { font-size: 1.08em; } .markdown h3 { font-size: 1em; }
        .markdown ul, .markdown ol { margin: .45em 0; padding-left: 1.35em; }
        .markdown li > p { margin: 0; }
        .markdown a { color: #1d4ed8; text-decoration: underline; overflow-wrap: anywhere; }
        .markdown code { padding: .1em .3em; border-radius: 4px; background: #e2e8f0; font-size: .88em; overflow-wrap: anywhere; }
        .markdown pre { overflow-x: auto; margin: .55em 0; padding: 10px 12px; border-radius: 8px; background: #1e293b; }
        .markdown pre code { background: none; color: #e2e8f0; font-size: .85em; }
        .sources {
          margin: -4px 0 12px; padding: 0 4px;
          color: #475569; font-size: 11px;
          display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: center;
        }
        .sources strong { flex-shrink: 0; }
        .source {
          display: inline-block; padding: 2px 7px; border-radius: 5px;
          background: #e2e8f0; white-space: nowrap;
          max-width: min(160px, 45vw); overflow: hidden; text-overflow: ellipsis;
        }
        .error {
          flex-shrink: 0;
          padding: 8px 14px; color: #b91c1c; background: #fef2f2;
          font-size: 12px; border-top: 1px solid #fecaca;
        }
        form {
          display: flex; gap: 8px;
          padding: 10px 12px;
          padding-bottom: max(10px, calc(10px + env(safe-area-inset-bottom, 0px)));
          border-top: 1px solid #e2e8f0; background: #fff;
          flex-shrink: 0;
        }
        input {
          min-width: 0; flex: 1;
          padding: 10px 12px;
          border: 1px solid #cbd5e1; border-radius: 10px;
          color: #0f172a; background: #fff;
          font: inherit;
          /* 16px prevents iOS Safari auto-zoom on focus */
          font-size: 16px;
          -webkit-appearance: none;
        }
        input:focus { outline: 3px solid #93c5fd; outline-offset: -1px; border-color: #93c5fd; }
        button[type=submit] {
          flex-shrink: 0;
          border: 0; border-radius: 10px;
          padding: 0 16px;
          min-height: 44px; min-width: 56px;
          background: #2563eb; color: #fff;
          cursor: pointer; font-weight: 600; font-size: 14px;
          -webkit-appearance: none;
        }
        button[type=submit]:disabled { cursor: wait; opacity: .55; }
        button[type=submit]:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
        .typing { color: #64748b; font-style: italic; }
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
          onClick={() => window.parent.postMessage({ type: "supportai:close" }, appOrigin)}
        >
          ✕
        </button>
      </header>
      <div className="messages" ref={messagesRef} aria-live="polite">
        {messages.map((item, index) => (
          <div key={`${item.role}-${index}`}>
            <div className={`message ${item.role}`}>
              {item.role === "assistant" ? (
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
              ) : (
                item.content
              )}
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
      <form onSubmit={submit}>
        <input
          ref={inputRef}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          aria-label="Message"
          autoComplete="off"
          maxLength={WIDGET_MAX_MESSAGE_LENGTH}
          placeholder="Type your question…"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !message.trim()}>Send</button>
      </form>
    </main>
  );
}
