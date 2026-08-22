export default function HistoryPage() {
    return (
        <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-6">
            <div className="flex max-w-md flex-col items-center text-center">
                {/* Icon */}
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50">
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-teal-600"
                        aria-hidden="true"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                </div>

                <h1 className="text-lg font-semibold text-slate-900">
                    Chat History
                </h1>

                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    View and search through your past conversations. This feature is coming soon.
                </p>

                <div className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Coming soon
                </div>
            </div>
        </div>
    );
}
