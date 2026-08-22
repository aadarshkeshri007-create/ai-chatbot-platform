import Link from "next/link";

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
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* ── Header ──────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 transition-colors group-hover:bg-teal-700"
            aria-hidden="true"
          >
            <span className="text-xs font-bold text-white">AI</span>
          </div>
          <span className="text-sm font-semibold text-slate-900">
            SupportAI
          </span>
        </Link>

        <nav className="flex items-center gap-3" aria-label="Account">
          <Link
            href="/signup"
            className="hidden rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors duration-150 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 sm:inline-flex"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all duration-150 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            Log in
          </Link>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <main className="relative flex flex-1 flex-col items-center px-6 sm:px-10">
        {/* Ambient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-16 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-teal-500/[0.07] blur-[100px]"
        />

        <div className="relative flex max-w-2xl flex-col items-center pt-24 pb-16 text-center sm:pt-32 sm:pb-20">
          <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-500" />
            AI-powered customer support
          </div>

          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-[2.75rem] sm:leading-[1.15]">
            Customer support that
            <span className="text-teal-600"> never sleeps</span>
          </h1>

          <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-500 sm:text-lg">
            Resolve customer questions instantly with an AI assistant trained on
            your knowledge base — no waiting, no queue.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/chat"
              className="group inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-teal-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 active:scale-[0.98]"
            >
              Get started
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
              className="inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors duration-150 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              Log in to your account
            </Link>
          </div>
        </div>

        {/* ── Features ──────────────────────────────────── */}
        <section
          className="w-full max-w-4xl pb-20"
          aria-labelledby="features-heading"
        >
          <h2 id="features-heading" className="sr-only">
            Features
          </h2>
          <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  {feature.icon}
                </div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white px-6 py-5 sm:px-10">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <span className="text-xs text-slate-400">
            © {new Date().getFullYear()} SupportAI
          </span>
        </div>
      </footer>
    </div>
  );
}