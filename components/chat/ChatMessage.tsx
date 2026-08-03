import { Message } from "@/types/message";
import MessageBubble from "@/components/chat/MessageBubble";
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
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
    </section>
  );
}