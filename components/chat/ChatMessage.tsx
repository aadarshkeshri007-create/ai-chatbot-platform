import { Message } from "@/types/message";
import MessageBubble from "@/components/chat/MessageBubble";
import TypingIndicator from "@/components/chat/TypingIndicator";
import EmptyState from "@/components/chat/EmptyState";

type ChatMessagesProps = {
  messages: Message[];
  messagesContainerRef: React.RefObject<HTMLElement | null>;
  onScroll: () => void;
  loading: boolean;
  onSuggestionClick?: (text: string) => void;
};

export default function ChatMessages({
  messages,
  messagesContainerRef,
  onScroll,
  loading,
  onSuggestionClick,
}: ChatMessagesProps) {
  // Determine if this is a "new chat" empty state:
  // single welcome message from assistant
  const isNewChat =
    messages.length === 1 &&
    messages[0].role === "assistant" &&
    messages[0].id === "new-chat";

  // Determine if the AI is currently streaming:
  // loading + last message is an empty assistant message
  const isStreaming =
    loading &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant" &&
    messages[messages.length - 1].content === "";

  return (
    <section
      ref={messagesContainerRef}
      onScroll={onScroll}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50 px-4 py-6 scrollbar-thin [overflow-anchor:none] sm:px-6"
    >
      {isNewChat ? (
        <EmptyState onSuggestionClick={onSuggestionClick} />
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((message) => {
            // Skip rendering the empty placeholder if we're showing the indicator
            if (
              isStreaming &&
              message === messages[messages.length - 1] &&
              message.content === ""
            ) {
              return null;
            }
            return <MessageBubble key={message.id} message={message} />;
          })}

          {isStreaming && <TypingIndicator />}
        </div>
      )}
    </section>
  );
}
