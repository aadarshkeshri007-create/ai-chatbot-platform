"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  normalizeAssistantMarkdown,
  sanitizeMarkdownUrl,
} from "@/lib/markdown-content";

type MessageContentProps = {
  content: string;
  isUser?: boolean;
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface)]/10 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
      aria-label={copied ? "Copied" : "Copy code"}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

export default function MessageContent({
  content,
  isUser = false,
}: MessageContentProps) {
  // Text color classes conditional on user vs assistant context and dark mode
  const textClass = isUser ? "text-white/90" : "text-[var(--text-primary)] dark:text-[var(--text-primary)]";
  const headingClass = isUser ? "text-white" : "text-[var(--text-primary)] dark:text-[var(--text-primary)]";
  const linkClass = isUser
    ? "text-white underline decoration-white/40"
    : "text-[var(--accent-link)] underline decoration-teal-300/50 hover:text-[var(--accent-link)] dark:text-[var(--accent-link)] dark:decoration-teal-500/30 dark:hover:text-teal-300";
  const inlineCodeClass = isUser
    ? "rounded bg-[var(--surface)]/15 px-1.5 py-0.5 font-mono text-[13px] text-white"
    : "rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-[13px] text-[var(--text-primary)] dark:bg-[var(--surface-muted)] dark:text-[var(--text-primary)]";
  const blockquoteClass = isUser
    ? "my-3 border-l-[3px] border-white/30 pl-3 italic text-white/80"
    : "my-3 border-l-[3px] border-[var(--border)] pl-3 italic text-[var(--text-secondary)] dark:border-[var(--border)] dark:text-[var(--text-secondary)]";

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className={`mb-3 mt-5 text-xl font-bold ${headingClass} first:mt-0`}>
            {children}
          </h1>
        ),

        h2: ({ children }) => (
          <h2 className={`mb-2 mt-4 text-lg font-semibold ${headingClass}`}>
            {children}
          </h2>
        ),

        h3: ({ children }) => (
          <h3 className={`mb-2 mt-3 text-base font-semibold ${headingClass}`}>
            {children}
          </h3>
        ),

        p: ({ children }) => (
          <p className={`mb-2 last:mb-0 leading-relaxed ${textClass}`}>
            {children}
          </p>
        ),

        ul: ({ children }) => (
          <ul className={`mb-2 ml-5 list-disc space-y-0.5 ${textClass}`}>
            {children}
          </ul>
        ),

        ol: ({ children }) => (
          <ol className={`mb-2 ml-5 list-decimal space-y-0.5 ${textClass}`}>
            {children}
          </ol>
        ),

        li: ({ children }) => (
          <li className="leading-relaxed">
            {children}
          </li>
        ),

        blockquote: ({ children }) => (
          <blockquote className={blockquoteClass}>
            {children}
          </blockquote>
        ),

        hr: () => (
          <hr className={`my-4 ${isUser ? "border-white/20" : "border-[var(--border)] dark:border-[var(--border)]"}`} />
        ),

        table: ({ children }) => (
          <div className="my-3 max-w-full overflow-x-auto scrollbar-thin rounded-lg border border-[var(--border)] dark:border-[var(--border)]">
            <table className="w-full min-w-full border-collapse text-sm">
              {children}
            </table>
          </div>
        ),

        thead: ({ children }) => (
          <thead className="bg-[var(--background)] dark:bg-[var(--surface-muted)]/60">
            {children}
          </thead>
        ),

        th: ({ children }) => (
          <th className="border-b border-[var(--border)] px-3 py-2 text-left text-xs font-semibold text-[var(--text-secondary)] dark:border-[var(--border)] dark:text-[var(--text-secondary)]">
            {children}
          </th>
        ),

        td: ({ children }) => (
          <td className="border-b border-[var(--border)] px-3 py-2 text-sm dark:border-[var(--border)] dark:text-[var(--text-secondary)]">
            {children}
          </td>
        ),

        strong: ({ children }) => (
          <strong className="font-semibold text-inherit">
            {children}
          </strong>
        ),

        a: ({ href, children }) => {
          const safeHref = sanitizeMarkdownUrl(href);
          if (!safeHref) {
            return (
              <span className="underline decoration-slate-400/50 break-words [overflow-wrap:anywhere]">
                {children}
              </span>
            );
          }
          return (
            <a
              href={safeHref}
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkClass} break-words [overflow-wrap:anywhere]`}
            >
              {children}
            </a>
          );
        },

        code({ className, children }) {
          const match = /language-(\w+)/.exec(className || "");

          if (match) {
            const codeString = String(children).replace(/\n$/, "");
            return (
              <div className="my-3 max-w-full overflow-hidden rounded-lg border border-[var(--border)]/50 first:mt-0">
                {/* Code header */}
                <div className="flex items-center justify-between bg-[#1e1e2e] px-3 py-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                    {match[1]}
                  </span>
                  <CopyButton text={codeString} />
                </div>
                <div className="overflow-x-auto scrollbar-thin max-w-full">
                  <SyntaxHighlighter
                    language={match[1]}
                    style={oneDark}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      borderRadius: 0,
                      padding: "0.875rem 1rem",
                      fontSize: "0.8125rem",
                      lineHeight: "1.6",
                      background: "#282a36",
                    }}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              </div>
            );
          }

          return (
            <code className={`${inlineCodeClass} break-words [overflow-wrap:anywhere]`}>
              {children}
            </code>
          );
        },
      }}
    >
      {isUser ? content : normalizeAssistantMarkdown(content)}
    </ReactMarkdown>
  );
}
