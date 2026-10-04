type EmptyStateProps = {
  onSuggestionClick?: (text: string) => void;
};

const suggestions = [
  "How do I reset my password?",
  "What are your business hours?",
  "I need help with my recent order",
];

export default function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        {/* Icon */}
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/40">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-teal-600 dark:text-teal-400"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M8 10h.01" />
            <path d="M12 10h.01" />
            <path d="M16 10h.01" />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          How can I help you today?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Ask a question about your account, orders, or anything else — I&apos;m here to help.
        </p>

        {/* Suggestion chips */}
        {onSuggestionClick && (
          <div className="mt-6 flex flex-col gap-2 w-full">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestionClick(suggestion)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-left text-sm text-slate-600 shadow-sm transition-all duration-150 hover:border-teal-200 hover:bg-teal-50/50 hover:text-teal-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-teal-600/50 dark:hover:bg-teal-950/30 dark:hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
