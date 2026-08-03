import { Message } from "@/types/message";
type ChatMessagesProps = {
  messages: Message[];
  messagesContainerRef: React.RefObject<HTMLElement | null>;
};

export default function ChatMessages({
  messages, messagesContainerRef
}: ChatMessagesProps) {
  return (
    <section ref={messagesContainerRef}
    className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                msg.role === "user"
                  ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-teal-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm sm:max-w-md"
                  : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm sm:max-w-md"
              }
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}