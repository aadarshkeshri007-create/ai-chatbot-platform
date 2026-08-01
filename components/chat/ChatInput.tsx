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
    <footer className="flex items-end gap-3 border-t border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex-1">
        <Input
          id="message"
          type="text"
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <Button type="button" onClick={onSend} disabled={!message.trim()}>
        Send
      </Button>
    </footer>
  );
}