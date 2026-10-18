import PageFrame from "@/components/PageFrame";
import PageHeader from "@/components/PageHeader";

export default function HistoryPage() {
    return (
        <PageFrame>
            <PageHeader
                eyebrow="Conversations"
                title="Chat history"
                description="Review previous customer conversations and return to the context you need."
            />
            <div className="flex min-h-[360px] items-center justify-center">
            <div className="surface flex max-w-md flex-col items-center border-dashed p-8 text-center">
                {/* Icon */}
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/40">
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-teal-600 dark:text-teal-400"
                        aria-hidden="true"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                </div>

                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Chat History
                </h2>

                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                    View and search through your past conversations. This feature is coming soon.
                </p>

                <div className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Coming soon
                </div>
                </div>
                </div>
        </PageFrame>
    );
}
