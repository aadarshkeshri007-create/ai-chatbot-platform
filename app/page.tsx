import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-600"
            aria-hidden="true"
          >
            <span className="text-xs font-bold text-white">AI</span>
          </div>
          <span className="text-sm font-semibold text-slate-900">
            Support Platform
          </span>
        </div>

        <nav aria-label="Account">
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors duration-150 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            Log in
          </Link>
        </nav>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-16 text-center sm:px-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500/10 blur-[90px]"
        />

        <div className="relative flex max-w-xl flex-col items-center">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            AI customer support,
            <span className="block text-teal-600">handled around the clock.</span>
          </h1>

          <p className="mt-5 max-w-md text-lg leading-relaxed text-slate-600">
            Resolve customer questions instantly with an AI assistant trained
            on your knowledge base — no waiting, no queue.
          </p>

          <Link
            href="/chat"
            className="group mt-10 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-teal-600/20 transition-all duration-150 hover:bg-teal-700 hover:shadow-md hover:shadow-teal-600/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            Start AI Chat
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="transition-transform duration-150 group-hover:translate-x-0.5"
            >
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </Link>

          <Link
            href="/dashboard"
            className="mt-5 rounded text-sm text-slate-500 underline-offset-4 transition-colors hover:text-slate-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            Go to dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}