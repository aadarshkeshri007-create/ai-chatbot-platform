"use client";

import Link from "next/link";
import { useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

interface SuggestedInquiry {
  id: string;
  pillLabel: string;
  userQuestion: string;
  assistantResponse: string;
  sources: { title: string; page?: string }[];
  handoffStatus: string;
}

const SUGGESTED_INQUIRIES: SuggestedInquiry[] = [
  {
    id: "returns",
    pillLabel: "How do I return?",
    userQuestion: "How long do I have to return an order?",
    assistantResponse:
      "Eligible orders can be returned within 30 days of delivery. You can generate a prepaid return label directly from your account orders tab.",
    sources: [
      { title: "Returns guide", page: "section 2" },
      { title: "Shipping & returns FAQ" },
    ],
    handoffStatus: "Human handoff available",
  },
  {
    id: "shipment",
    pillLabel: "Track shipment",
    userQuestion: "Can I track my delivery status?",
    assistantResponse:
      "Standard shipping arrives in 3–5 business days. Once your package is scanned by the carrier, tracking updates appear under your order details.",
    sources: [
      { title: "Delivery SLAs & carriers" },
      { title: "Order tracking FAQ" },
    ],
    handoffStatus: "Human handoff available",
  },
  {
    id: "address",
    pillLabel: "Change address",
    userQuestion: "Can I change my delivery address after placing an order?",
    assistantResponse:
      "Address edits are accepted within 60 minutes of placing an order before fulfillment begins. After 60 minutes, our support team can coordinate with the carrier.",
    sources: [
      { title: "Order modification policy", page: "p. 4" },
      { title: "Fulfillment timeline" },
    ],
    handoffStatus: "Human agent ready",
  },
  {
    id: "refunds",
    pillLabel: "Refund policy",
    userQuestion: "How long does a refund take to process?",
    assistantResponse:
      "Once our warehouse inspects the returned item (typically 1–2 business days), refunds are credited back to your original payment method in 3–5 banking days.",
    sources: [
      { title: "Billing & refunds terms" },
      { title: "Accounting SLA" },
    ],
    handoffStatus: "Human handoff available",
  },
];

const features = [
  {
    title: "Answers with context",
    description:
      "Use uploaded PDF knowledge to ground assistant answers and show each source beside its response.",
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
    title: "Human handoffs",
    description:
      "Give visitors a way to reach your team, then manage the request with its conversation context.",
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
    title: "Conversation history",
    description:
      "Review saved assistant chats and support handoffs from the same workspace.",
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
  const [activeId, setActiveId] = useState<string>("returns");
  const activeInquiry =
    SUGGESTED_INQUIRIES.find((item) => item.id === activeId) ??
    SUGGESTED_INQUIRIES[0];

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[var(--background)] text-[var(--text-primary)] transition-colors duration-150">
      {/* ── Header ──────────────────────────────────────── */}
      <header className="flex w-full min-w-0 items-center justify-between border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] px-4 py-3 sm:px-10 sm:py-4 transition-colors duration-150">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 group">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[0.7rem] bg-[var(--accent)] text-white transition-colors group-hover:brightness-95"
            aria-hidden="true"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-9.5A7.5 7.5 0 0 1 10.5 4h2A7.5 7.5 0 0 1 20 11.5Z" />
              <path d="M8 12h8M8 15h5" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            SupportAI
          </span>
        </Link>

        <nav
          className="flex shrink-0 items-center gap-2 sm:gap-3"
          aria-label="Account navigation"
        >
          <ThemeToggle />
          <Link
            href="/signup"
            className="hidden rounded-lg px-3.5 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] sm:inline-flex"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm font-medium text-[var(--text-primary)] shadow-sm transition-all duration-150 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] sm:min-h-0"
          >
            Log in
          </Link>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <main className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col px-4 sm:px-8 lg:px-12">
        <section
          className="grid flex-1 min-w-0 items-center gap-12 py-12 sm:py-16 lg:grid-cols-[minmax(0,.92fr)_minmax(460px,1.08fr)] lg:gap-16 lg:py-20"
          aria-labelledby="hero-title"
        >
          {/* Left Column: Typography & CTAs */}
          <div className="w-full min-w-0 max-w-xl">
            <p className="workspace-kicker">Customer support, in context</p>
            <h1
              id="hero-title"
              className="mt-4 text-3xl font-semibold leading-[1.08] tracking-[-0.045em] text-[var(--text-primary)] sm:text-5xl lg:text-6xl"
            >
              Clear answers.
              <br />
              <span className="text-[var(--text-secondary)]">
                Human help when it matters.
              </span>
            </h1>
            <p className="mt-6 max-w-[44ch] text-base leading-7 text-[var(--text-secondary)] sm:text-lg sm:leading-8">
              Bring your knowledge, assistant conversations, and human follow-up
              into one calm, capable workspace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/signup"
                className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-xs transition-all duration-150 hover:brightness-95 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
              >
                Create an account
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-5 text-sm font-medium text-[var(--text-primary)] shadow-xs transition-all duration-150 hover:bg-[var(--surface-muted)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
              >
                Log in
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="text-[var(--accent)]"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span>PDF knowledge base</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="text-[var(--accent)]"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span>Grounding citations</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="text-[var(--accent)]"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span>Human handoffs</span>
              </span>
            </div>
          </div>

          {/* Right Column: 3D Assistant Preview */}
          <div className="relative mx-auto w-full min-w-0 max-w-[660px] lg:[perspective:1100px]">
            {/* Ambient accent depth glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-2 rounded-2xl bg-gradient-to-tr from-[var(--accent-soft)] via-transparent to-[var(--surface-muted)] opacity-35 blur-xl transition-opacity duration-300"
            />

            <div className="workspace-surface group relative min-w-0 overflow-hidden rounded-[var(--radius-panel)] p-4 shadow-[var(--shadow-soft)] sm:p-6 transition-all duration-300 ease-out lg:[transform:rotateY(-2.5deg)_rotateX(2deg)] lg:hover:[transform:rotateY(0deg)_rotateX(0deg)_translateY(-2px)] lg:hover:shadow-lg">
              {/* Card Header & Inquiry Selector */}
              <div className="flex flex-col gap-3.5 border-b border-[var(--border)] pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent)] text-white shadow-2xs"
                      aria-hidden="true"
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-9.5A7.5 7.5 0 0 1 10.5 4h2A7.5 7.5 0 0 1 20 11.5Z" />
                        <path d="M8 12h8M8 15h5" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          Assistant preview
                        </p>
                        <span className="inline-flex items-center rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                          Interactive
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Demonstrating grounded support responses
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[var(--success-soft)] px-2.5 py-1 text-xs font-medium text-[var(--success)] shadow-2xs">
                    Grounded answer
                  </span>
                </div>

                {/* Suggested Inquiries Selector */}
                <div className="pt-1">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Try an inquiry:
                  </p>
                  <div
                    aria-label="Suggested support inquiries"
                    className="flex flex-wrap items-center gap-1.5 sm:gap-2"
                  >
                    {SUGGESTED_INQUIRIES.map((inquiry) => {
                      const isSelected = inquiry.id === activeInquiry.id;
                      return (
                        <button
                          key={inquiry.id}
                          type="button"
                          id={`inquiry-btn-${inquiry.id}`}
                          aria-pressed={isSelected}
                          aria-label={`Ask: ${inquiry.userQuestion}`}
                          onClick={() => setActiveId(inquiry.id)}
                          className={`group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 ${
                            isSelected
                              ? "border border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-link)] font-semibold shadow-2xs"
                              : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] active:scale-[0.98]"
                          }`}
                        >
                          {isSelected && (
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
                              aria-hidden="true"
                            />
                          )}
                          <span>{inquiry.pillLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Dynamic Conversation Panel */}
              <div
                id="hero-conversation-panel"
                aria-live="polite"
                aria-atomic="false"
                className="flex min-h-[270px] flex-col justify-end gap-3.5 py-4 sm:min-h-[300px]"
              >
                <div
                  key={activeInquiry.id}
                  className="animate-[fadeInUp_250ms_cubic-bezier(0.16,1,0.3,1)] flex flex-col gap-3.5"
                >
                  {/* User Question */}
                  <div className="ml-auto max-w-[88%] break-words rounded-[1.1rem] rounded-br-sm bg-[var(--accent)] px-4 py-3 text-sm leading-6 text-white shadow-2xs">
                    {activeInquiry.userQuestion}
                  </div>

                  {/* Grounded Assistant Answer */}
                  <div className="max-w-[95%] break-words rounded-[1.1rem] rounded-bl-sm border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-primary)] shadow-2xs">
                    <p className="text-[var(--text-primary)]">
                      {activeInquiry.assistantResponse}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-[color-mix(in_srgb,var(--border)_60%,transparent)]">
                      <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                        Citations:
                      </span>
                      {activeInquiry.sources.map((src, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)] shadow-2xs"
                        >
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            className="text-[var(--accent-link)]"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <span>
                            {src.title}
                            {src.page ? `, ${src.page}` : ""}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="ml-auto flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)] shadow-2xs">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
                    </span>
                    <span>{activeInquiry.handoffStatus}</span>
                  </div>
                </div>
              </div>

              {/* Simulated Composer Footer */}
              <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    readOnly
                    aria-label="Simulated customer support question input"
                    value={activeInquiry.userQuestion}
                    className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3.5 py-2 text-xs text-[var(--text-secondary)] focus:outline-none cursor-default select-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[var(--text-secondary)] opacity-60">
                    Select inquiry above
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Advance to next suggested inquiry"
                  title="Next inquiry"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] text-white shadow-2xs transition hover:brightness-95 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                  onClick={() => {
                    const currentIndex = SUGGESTED_INQUIRIES.findIndex(
                      (i) => i.id === activeInquiry.id
                    );
                    const nextIndex =
                      (currentIndex + 1) % SUGGESTED_INQUIRIES.length;
                    setActiveId(SUGGESTED_INQUIRIES[nextIndex].id);
                  }}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m22 2-7 20-4-9-9-4Z" />
                    <path d="M22 2 11 13" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features Section ────────────────────────────── */}
        <section
          className="border-t border-[var(--border)] py-10 sm:py-12"
          aria-labelledby="features-heading"
        >
          <div className="grid gap-8 sm:grid-cols-[minmax(180px,.65fr)_minmax(0,1.35fr)] sm:gap-12">
            <h2
              id="features-heading"
              className="max-w-[18ch] text-xl font-semibold leading-snug tracking-[-0.035em] text-[var(--text-primary)]"
            >
              The full support conversation, in one place.
            </h2>
            <div className="grid gap-6 md:grid-cols-3 md:gap-8">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="border-t border-[var(--border)] pt-4"
                >
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-link)]">
                    {feature.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-4 [padding-bottom:calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-10 transition-colors duration-150">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">
            © {new Date().getFullYear()} SupportAI
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/signup"
              className="text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
            >
              Sign up
            </Link>
            <Link
              href="/login"
              className="text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
            >
              Log in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
