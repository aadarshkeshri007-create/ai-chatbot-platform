type PageFrameProps = {
    children: React.ReactNode;
    className?: string;
};

export default function PageFrame({ children, className = "" }: PageFrameProps) {
    return (
        <div className={`app-scroll min-h-0 flex-1 bg-[var(--background)] px-4 py-5 pb-[max(1.25rem,calc(1.25rem+env(safe-area-inset-bottom,0px)))] transition-colors duration-150 sm:px-7 sm:py-7 lg:px-10 lg:py-9 ${className}`}>
            <main className="mx-auto w-full max-w-7xl">{children}</main>
        </div>
    );
}
