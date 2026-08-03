import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

type MessageContentProps = {
  content: string;
};

export default function MessageContent({
  content,
}: MessageContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="mb-4 mt-6 text-3xl font-bold text-slate-900 first:mt-0">
            {children}
          </h1>
        ),

        h2: ({ children }) => (
          <h2 className="mb-3 mt-5 text-2xl font-semibold text-slate-900">
            {children}
          </h2>
        ),

        h3: ({ children }) => (
          <h3 className="mb-2 mt-4 text-xl font-semibold text-slate-900">
            {children}
          </h3>
        ),

        p: ({ children }) => (
          <p className="mb-2 leading-7 text-slate-800">
            {children}
          </p>
        ),

        ul: ({ children }) => (
          <ul className="mb-3 ml-6 list-disc space-y-1">
            {children}
          </ul>
        ),

        ol: ({ children }) => (
          <ol className="mb-3 ml-6 list-decimal space-y-1">
            {children}
          </ol>
        ),

        li: ({ children }) => (
          <li className="leading-7">
            {children}
          </li>
        ),

        blockquote: ({ children }) => (
          <blockquote className="my-4 border-l-4 border-slate-300 pl-4 italic text-slate-600">
            {children}
          </blockquote>
        ),

        hr: () => (
          <hr className="my-6 border-slate-300" />
        ),

        table: ({ children }) => (
          <div className="my-4 overflow-x-auto">
            <table className="w-full border-collapse border border-slate-300">
              {children}
            </table>
          </div>
        ),

        thead: ({ children }) => (
          <thead className="bg-slate-100">
            {children}
          </thead>
        ),

        th: ({ children }) => (
          <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
            {children}
          </th>
        ),

        td: ({ children }) => (
          <td className="border border-slate-300 px-3 py-2">
            {children}
          </td>
        ),

        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800"
          >
            {children}
          </a>
        ),

        code({ className, children }) {
          const match = /language-(\w+)/.exec(className || "");

          if (match) {
            return (
              <SyntaxHighlighter
                language={match[1]}
                style={oneDark}
                PreTag="div"
                customStyle={{
                  margin: "1rem 0",
                  borderRadius: "12px",
                  padding: "1rem",
                  fontSize: "0.9rem",
                }}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            );
          }

          return (
            <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-sm text-slate-900">
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