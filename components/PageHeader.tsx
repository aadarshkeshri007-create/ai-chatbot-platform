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
        <header className="mb-7 flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                {eyebrow && (
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--accent-link)]">
                        {eyebrow}
                    </p>
                )}
                <h1 className="text-[1.65rem] font-semibold leading-tight tracking-[-0.045em] text-[var(--text-primary)] sm:text-[2rem]">
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
