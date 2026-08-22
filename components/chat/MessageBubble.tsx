import type { Message } from "@/types/message";
import MessageContent from "./MessageContent";

type MessageBubbleProps = {
  message: Message;
};

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Assistant avatar */}
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-600 mt-0.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.5V20a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2.5c2.9-1.2 5-4.1 5-7.5a8 8 0 0 0-8-8z" />
            <path d="M10 22h4" />
          </svg>
        </div>
      )}

      <div
        className={
          isUser
            ? "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-teal-600 px-4 py-2.5 text-[14px] leading-relaxed text-white shadow-sm sm:max-w-lg"
            : "max-w-[80%] min-w-0 whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-2.5 text-[14px] leading-relaxed text-slate-800 shadow-sm sm:max-w-2xl"
        }
      >
        <MessageContent content={message.content} isUser={isUser} />
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-700 mt-0.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      )}
    </div>
  );
}