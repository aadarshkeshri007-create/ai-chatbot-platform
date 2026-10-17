"use client";

import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

type ChatHeaderProps = {
  onToggleSidebar: () => void;
};

const PAGE_TITLES: Record<string, string> = {
  "/chat": "AI Assistant",
  "/history": "Chat History",
  "/upload": "Knowledge Base",
  "/settings": "Settings",
  "/profile": "Profile",
};

export default function ChatHeader({ onToggleSidebar }: ChatHeaderProps) {
  const pathname = usePathname();
  const pageTitle = PAGE_TITLES[pathname] ?? "AI Assistant";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-5 transition-colors duration-150 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile hamburger — 44px min touch target */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex h-10 w-10 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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
          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-400 dark:bg-emerald-500" aria-hidden="true" />
          <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {pageTitle}
          </span>
        </div>
      </div>

      {/* Header controls: Theme toggle */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}