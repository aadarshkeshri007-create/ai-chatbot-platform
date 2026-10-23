export default function TypingIndicator() {
  return (
    <div className="flex justify-start animate-[fadeInUp_150ms_ease-out]">
      <div className="flex items-center gap-3 px-1">
        {/* Avatar */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] dark:bg-[var(--accent)] shadow-sm">
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

        {/* Dots bubble */}
        <div
          className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm dark:border-[var(--border)] dark:bg-[var(--surface)]"
          role="status"
          aria-label="Assistant is thinking"
          aria-live="polite"
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
            style={{ animation: "pulseDot 1.4s ease-in-out infinite" }}
          />
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
            style={{
              animation: "pulseDot 1.4s ease-in-out infinite",
              animationDelay: "0.2s",
            }}
          />
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
            style={{
              animation: "pulseDot 1.4s ease-in-out infinite",
              animationDelay: "0.4s",
            }}
          />
        </div>
      </div>
    </div>
  );
}
