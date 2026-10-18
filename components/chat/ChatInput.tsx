"use client";

import { useRef, useEffect, useCallback } from "react";

type ChatInputProps = {
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  onSend: () => void;
  loading: boolean;
};

export default function ChatInput({
  message,
  setMessage,
  onSend,
  loading,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [message, adjustHeight]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !loading) {
      e.preventDefault();
      onSend();
    }
  };

  const canSend = message.trim().length > 0 && !loading;

  return (
    <footer className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-5 sm:py-4 transition-colors duration-150">
      <div className="mx-auto flex max-w-3xl items-end gap-3">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            id="chat-message-input"
            placeholder="Type your message…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
            className="max-h-40 w-full resize-none overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-2.5 sm:px-4 text-base sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] shadow-sm transition-colors duration-150 focus:border-[var(--focus)] focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]/15 disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-secondary)] disabled:cursor-not-allowed"
            aria-label="Chat message"
          />
        </div>

        {/* Send button */}
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="flex h-11 w-11 sm:h-10 sm:w-10 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white shadow-sm transition-all duration-150 hover:brightness-95 active:scale-[0.95] disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-secondary)] disabled:shadow-none disabled:active:scale-100"
          aria-label={loading ? "Sending message" : "Send message"}
        >
          {loading ? (
            <svg
              className="h-4 w-4 animate-spin-slow"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                opacity="0.3"
              />
              <path
                d="M12 2a10 10 0 0 1 10 10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </footer>
  );
}
