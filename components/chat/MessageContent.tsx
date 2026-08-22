"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

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
      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
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
  // Text color classes conditional on user vs assistant context
  const textClass = isUser ? "text-white/90" : "text-slate-800";
  const headingClass = isUser ? "text-white" : "text-slate-900";
  const linkClass = isUser
    ? "text-white underline decoration-white/40"
    : "text-teal-600 underline decoration-teal-300/50 hover:text-teal-700";
  const inlineCodeClass = isUser
    ? "rounded bg-white/15 px-1.5 py-0.5 font-mono text-[13px] text-white"
    : "rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800";
  const blockquoteClass = isUser
    ? "my-3 border-l-[3px] border-white/30 pl-3 italic text-white/80"
    : "my-3 border-l-[3px] border-slate-300 pl-3 italic text-slate-500";

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
          <hr className={`my-4 ${isUser ? "border-white/20" : "border-slate-200"}`} />
        ),

        table: ({ children }) => (
          <div className="my-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-sm">
              {children}
            </table>
          </div>
        ),

        thead: ({ children }) => (
          <thead className="bg-slate-50">
            {children}
          </thead>
        ),

        th: ({ children }) => (
          <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600">
            {children}
          </th>
        ),

        td: ({ children }) => (
          <td className="border-b border-slate-100 px-3 py-2 text-sm">
            {children}
          </td>
        ),

        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {children}
          </a>
        ),

        code({ className, children }) {
          const match = /language-(\w+)/.exec(className || "");

          if (match) {
            const codeString = String(children).replace(/\n$/, "");
            return (
              <div className="my-3 overflow-hidden rounded-lg border border-slate-700/50 first:mt-0">
                {/* Code header */}
                <div className="flex items-center justify-between bg-[#1e1e2e] px-3 py-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    {match[1]}
                  </span>
                  <CopyButton text={codeString} />
                </div>
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
            );
          }

          return (
            <code className={inlineCodeClass}>
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}