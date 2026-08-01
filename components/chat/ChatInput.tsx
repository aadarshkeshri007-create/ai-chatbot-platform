import Button from "@/components/Button";
import Input from "../Input";

type ChatInputProps = {
    message: string;
    setMessage: React.Dispatch<React.SetStateAction<string>>;
    onSend: () => void;
};

export default function ChatInput({
  message,
  setMessage, onSend
}: ChatInputProps) {
  return (
    <footer className="flex items-center gap-2 border-t border-gray-200 p-4">
      <Input
        id="message"
        type="text"
        placeholder="Type your message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="w-full flex-1 rounded-lg border border-gray-300 p-2.5 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
      <Button type="button" onClick={onSend} disabled={!message.trim()} className="bg-blue-500 hover:bg-blue-600">
        Send
      </Button>
    </footer>
  );
}