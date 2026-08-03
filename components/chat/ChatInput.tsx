import Button from "@/components/Button";
import Input from "../Input";

type ChatInputProps = {
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  onSend: () => void;
  loading: boolean;
};

export default function ChatInput({
  message,
  setMessage, onSend, loading
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !loading && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };
  return (
    <footer className="flex items-end gap-3 border-t border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex-1">
        <Input
          id="message"
          type="text"
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={loading}
          onKeyDown={handleKeyDown}
        />
      </div>
      <Button type="button" onClick={onSend} disabled={!message.trim() || loading}>
        {loading ? "Sending..." : "Send"}
      </Button>
    </footer>
  );
}