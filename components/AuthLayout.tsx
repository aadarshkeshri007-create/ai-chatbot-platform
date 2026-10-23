import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-[var(--background)] text-[var(--text-primary)] lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,.95fr)]">
      <aside className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-[var(--nav-background)] px-10 py-9 text-[var(--nav-text-primary)] lg:flex xl:px-16 xl:py-12">
        <Link href="/" className="relative z-10 flex items-center gap-3" aria-label="SupportAI home">
          <span className="flex h-10 w-10 items-center justify-center rounded-[0.7rem] bg-[var(--nav-active)] text-[var(--nav-accent)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-9.5A7.5 7.5 0 0 1 10.5 4h2A7.5 7.5 0 0 1 20 11.5Z" />
              <path d="M8 12h8M8 15h5" />
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight">SupportAI</span>
        </Link>

        <div className="relative z-10 mx-auto my-12 w-full max-w-xl">
          <p className="workspace-kicker !text-[var(--nav-accent)]">Support, in context</p>
          <h1 className="mt-4 max-w-[15ch] text-4xl font-semibold leading-[1.08] tracking-[-0.045em] xl:text-5xl">
            Keep every answer close to its source.
          </h1>
          <p className="mt-5 max-w-[42ch] text-base leading-7 text-[var(--nav-text-secondary)]">
            Bring your knowledge, assistant conversations, and human follow-up into one clear workspace.
          </p>

          <div className="mt-10 max-w-lg rounded-[var(--radius-panel)] border border-[var(--nav-border)] bg-[var(--nav-active)]/60 p-5">
            <p className="text-[11px] font-medium text-[var(--nav-text-muted)]">Illustrative conversation</p>
            <div className="mt-4 ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-[var(--nav-background)] px-4 py-3 text-sm leading-6 text-[var(--nav-text-primary)]">
              Can I return an item bought last month?
            </div>
            <div className="mt-3 max-w-[90%] rounded-xl rounded-bl-sm border border-[var(--nav-border)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--text-primary)]">
              Your returns guide explains the eligible return window and next steps.
              <div className="mt-3 inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                Returns guide · section 2
              </div>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-[var(--nav-text-muted)]">Grounded answers · Human follow-up · Clear history</p>
      </aside>

      <section className="relative flex min-h-screen flex-col items-center justify-center px-5 py-20 sm:px-10">
        <div className="absolute right-4 top-4 sm:right-7 sm:top-7">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-[420px]">{children}</div>
        <Link href="/" className="mt-8 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-link)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">
          Return to SupportAI
        </Link>
      </section>
    </main>
  );
}
