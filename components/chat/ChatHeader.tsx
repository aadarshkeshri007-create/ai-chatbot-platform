"use client";

import { usePathname } from "next/navigation";

type ChatHeaderProps = {
  onToggleSidebar: () => void;
};

const PAGE_TITLES: Record<string, string> = {
  "/chat": "Test your assistant",
  "/history": "Chat History",
  "/upload": "Knowledge Base",
  "/handoffs": "Support Inbox",
  "/settings": "Settings",
  "/profile": "Profile",
};

export default function ChatHeader({ onToggleSidebar }: ChatHeaderProps) {
  const pathname = usePathname();
  const pageTitle = PAGE_TITLES[pathname] ?? "AI Assistant";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-7 transition-colors duration-150">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile hamburger — 44px min touch target */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex h-10 w-10 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] lg:hidden"
          aria-label="Toggle sidebar"
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

        {/* Title area */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--success)]" aria-hidden="true" />
          <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {pageTitle}
          </span>
        </div>
      </div>

    </header>
  );
}
