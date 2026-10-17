import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

const features = [
  {
    title: "24/7 Availability",
    description:
      "Your AI assistant never sleeps. Customers get instant help any time of day, in any timezone.",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    title: "Instant Responses",
    description:
      "No queues, no hold music. AI resolves common questions in seconds with accurate, contextual answers.",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    title: "Knowledge Base",
    description:
      "Train the AI on your documentation, FAQs, and policies so every response is relevant to your business.",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <path d="M8 7h8" />
        <path d="M8 11h6" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-150">
      {/* ── Header ──────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-slate-200/60 bg-slate-50/80 px-4 py-3 backdrop-blur-sm sm:px-10 sm:py-4 dark:border-slate-800/60 dark:bg-slate-950/80 transition-colors duration-150">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 transition-colors group-hover:bg-teal-700 shadow-sm"
            aria-hidden="true"
          >
            <span className="text-xs font-bold text-white">AI</span>
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            SupportAI
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Account navigation">
          <ThemeToggle />
          <Link
            href="/signup"
            className="hidden rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors duration-150 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 sm:inline-flex"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all duration-150 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-teal-600 dark:hover:bg-teal-950/40 dark:hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 sm:min-h-0"
          >
            Log in
          </Link>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <main className="relative flex flex-1 flex-col items-center px-4 sm:px-10">
        {/* Ambient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-10 h-72 w-[min(40rem,100vw)] -translate-x-1/2 rounded-full bg-teal-500/[0.08] blur-[80px] dark:bg-teal-500/[0.15]"
        />

        <div className="relative flex w-full max-w-2xl flex-col items-center pb-10 pt-10 text-center sm:pb-20 sm:pt-28">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-500" />
            AI-powered customer support
          </div>

          <h1 className="text-[1.85rem] font-bold leading-[1.18] tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl sm:leading-[1.1] md:text-[3.25rem]">
            Customer support that
            <span className="text-teal-600 dark:text-teal-400"> never sleeps</span>
          </h1>

          <p className="mt-4 max-w-[34ch] text-base leading-relaxed text-slate-500 dark:text-slate-400 sm:max-w-lg sm:text-lg">
            Resolve customer questions instantly with an AI assistant trained on
            your knowledge base — no waiting, no queue.
          </p>

          <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:items-center sm:justify-center sm:gap-4">
            <Link
              href="/signup"
              className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-teal-700 hover:shadow-md dark:bg-teal-500 dark:hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 active:scale-[0.98] sm:min-h-0 sm:rounded-lg sm:py-2.5"
            >
              Get started free
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
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
              href="/login"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all duration-150 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-teal-600 dark:hover:bg-teal-950/40 dark:hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 sm:min-h-0 sm:rounded-lg sm:py-2.5"
            >
              Log in to your account
            </Link>
          </div>
        </div>

        {/* ── Features ──────────────────────────────────── */}
        <section
          className="w-full max-w-4xl pb-16 sm:pb-24"
          aria-labelledby="features-heading"
        >
          <h2 id="features-heading" className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 sm:mb-6">
            Everything you need
          </h2>
          <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
                  {feature.icon}
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white px-4 py-4 [padding-bottom:calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-10 dark:border-slate-800 dark:bg-slate-900 transition-colors duration-150">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <span className="text-xs text-slate-400 dark:text-slate-500">
            © {new Date().getFullYear()} SupportAI
          </span>
          <div className="flex items-center gap-4">
            <Link href="/signup" className="text-xs text-slate-400 transition-colors hover:text-teal-600 dark:text-slate-500 dark:hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
              Sign up
            </Link>
            <Link href="/login" className="text-xs text-slate-400 transition-colors hover:text-teal-600 dark:text-slate-500 dark:hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
              Log in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}