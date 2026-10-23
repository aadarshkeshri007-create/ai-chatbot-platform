import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-6 text-center dark:bg-[var(--background)]">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] shadow-sm">
        <span className="text-sm font-bold text-white">AI</span>
      </div>
      <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-[var(--accent-link)] dark:text-[var(--accent-link)]">
        404
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)] dark:text-[var(--text-primary)]">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
        The page you requested does not exist or may have moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-[44px] items-center rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
      >
        Return home
      </Link>
    </main>
  );
}
