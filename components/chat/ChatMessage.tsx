import { Message } from "@/types/message";
type ChatMessagesProps = {
  messages: Message[];
};

export default function ChatMessages({
  messages,
}: ChatMessagesProps) {
  return (
    <section className="flex-1 overflow-y-auto p-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={msg.role === "user" ? "flex justify-end py-1 whitespace-pre-wrap" : "flex justify-start py-1 whitespace-pre-wrap"}
        >
          <div className={msg.role === "user" ? "bg-blue-500 max-w-md  text-white px-4 py-3 rounded-lg" : "bg-gray-200 text-gray-800 max-w-md px-4 py-3 rounded-lg"}>
            {msg.content}
          </div>
        </div>
      ))}
    </section>
  );
}