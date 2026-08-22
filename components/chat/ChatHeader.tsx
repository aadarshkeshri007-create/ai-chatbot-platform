"use client";

import { usePathname } from "next/navigation";

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
    <header className="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-5">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={onToggleSidebar}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        aria-label="Toggle sidebar"
      >
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
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Title area */}
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
        <span className="text-sm font-medium text-slate-900">
          {pageTitle}
        </span>
      </div>
    </header>
  );
}