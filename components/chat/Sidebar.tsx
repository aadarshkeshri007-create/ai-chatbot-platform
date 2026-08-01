import Link from "next/link";
export default function Sidebar() {
  return (
    <aside className="flex w-64 flex-col gap-6 border-r border-slate-200 bg-white p-4">
      <div className="px-2 pt-1">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">
          AI Customer Support
        </h2>
      </div>
      <nav className="flex flex-col gap-1.5">
        <button className="rounded-lg bg-teal-600 px-3 py-2.5 text-left text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
          New Chat
        </button>
        <Link
          className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          href="/history"
        >
          Chat History
        </Link>
        <Link
          className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          href="/upload"
        >
          Upload Documents
        </Link>
      </nav>
      <div className="mt-auto flex items-center gap-2 border-t border-slate-200 pt-4">
        <Link
          className="flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          href="/settings"
        >
          Settings
        </Link>
        <Link
          className="flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          href="/profile"
        >
          Profile
        </Link>
      </div>
    </aside>
  );
}