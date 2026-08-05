import { Message } from "@/types/message";
import MessageBubble from "@/components/chat/MessageBubble";
type ChatMessagesProps = {
  messages: Message[];
  messagesContainerRef: React.RefObject<HTMLElement | null>;
  onScroll: () => void;
};

export default function ChatMessages({
  messages, messagesContainerRef, onScroll
}: ChatMessagesProps) {
  return (
    <section
      ref={messagesContainerRef}
      onScroll={onScroll}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50 px-4 py-6 [overflow-anchor:none] sm:px-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
    </section>
  );
}
