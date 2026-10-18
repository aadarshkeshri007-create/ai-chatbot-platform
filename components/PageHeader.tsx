type PageHeaderProps = {
    eyebrow?: string;
    title: string;
    description: string;
    action?: React.ReactNode;
};

export default function PageHeader({
    eyebrow,
    title,
    description,
    action,
}: PageHeaderProps) {
    return (
        <header className="mb-8 flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                {eyebrow && (
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                        {eyebrow}
                    </p>
                )}
                <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] sm:text-3xl">
                    {title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                    {description}
                </p>
            </div>
            {action}
        </header>
    );
}
