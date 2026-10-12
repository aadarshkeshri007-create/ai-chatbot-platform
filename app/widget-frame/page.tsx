"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

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
      const response = await fetch("/api/public/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistant_id: assistantId, message: cleanMessage }),
      });
      const payload: {
        assistant_name?: string;
        welcome_message?: string;
        response?: string;
        sources?: Source[];
        error?: string;
      } = await response.json();

      if (!response.ok) throw new Error(payload.error || "Unable to send your message.");
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
        * { box-sizing: border-box; }
        html, body { height: 100%; margin: 0; }
        body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .widget { display: flex; flex-direction: column; height: 100%; overflow: hidden; color: #0f172a; background: #fff; }
        .header { padding: 17px 18px; color: #fff; background: #1d4ed8; }
        .name { margin: 0; font-size: 16px; font-weight: 700; }
        .status { margin: 3px 0 0; font-size: 12px; opacity: .82; }
        .messages { flex: 1; overflow-y: auto; padding: 16px; background: #f8fafc; }
        .message { max-width: 88%; margin: 0 0 12px; padding: 10px 12px; border-radius: 13px; overflow-wrap: anywhere; font-size: 14px; line-height: 1.45; }
        .assistant { background: #fff; border: 1px solid #e2e8f0; }
        .user { margin-left: auto; white-space: pre-wrap; background: #2563eb; color: #fff; }
        .markdown > :first-child { margin-top: 0; }
        .markdown > :last-child { margin-bottom: 0; }
        .markdown p { margin: .55em 0; }
        .markdown h1, .markdown h2, .markdown h3 { margin: .7em 0 .35em; line-height: 1.2; }
        .markdown h1 { font-size: 1.25em; } .markdown h2 { font-size: 1.12em; } .markdown h3 { font-size: 1em; }
        .markdown ul, .markdown ol { margin: .45em 0; padding-left: 1.35em; }
        .markdown li > p { margin: 0; }
        .markdown a { color: #1d4ed8; text-decoration: underline; }
        .markdown code { padding: .1em .25em; border-radius: 4px; background: #e2e8f0; font-size: .9em; }
        .sources { margin: -5px 0 12px; padding: 0 5px; color: #475569; font-size: 11px; }
        .source { display: inline-block; margin: 2px 4px 0 0; padding: 3px 6px; border-radius: 5px; background: #e2e8f0; }
        .error { padding: 8px 16px; color: #b91c1c; background: #fef2f2; font-size: 12px; }
        form { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #e2e8f0; background: #fff; }
        input { min-width: 0; flex: 1; padding: 10px 11px; border: 1px solid #cbd5e1; border-radius: 10px; color: #0f172a; font: inherit; font-size: 14px; }
        button { border: 0; border-radius: 10px; padding: 0 14px; background: #2563eb; color: #fff; cursor: pointer; font-weight: 600; }
        button:disabled { cursor: wait; opacity: .55; }
        :focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
        .typing { color: #64748b; font-style: italic; }
      `}</style>
      <header className="header">
        <p className="name">{assistantName}</p>
        <p className="status">Ask us a question</p>
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
          maxLength={8000}
          placeholder="Type your question…"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !message.trim()}>Send</button>
      </form>
    </main>
  );
}
