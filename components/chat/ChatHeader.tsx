"use client";

type ChatHeaderProps = {
  onToggleSidebar: () => void;
};

export default function ChatHeader({ onToggleSidebar }: ChatHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--nav-border)] bg-[var(--nav-background)] px-3 transition-colors duration-150 lg:hidden">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile hamburger — 44px min touch target */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--nav-text-secondary)] transition-all duration-150 hover:bg-[var(--nav-hover)] hover:text-[var(--nav-text-primary)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nav-accent)]"
          aria-label="Open workspace navigation"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

      </div>
      <span className="text-sm font-semibold tracking-[-0.02em] text-[var(--nav-text-primary)]">SupportAI</span>
    </header>
  );
}
