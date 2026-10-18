type PageFrameProps = {
    children: React.ReactNode;
    className?: string;
};

export default function PageFrame({ children, className = "" }: PageFrameProps) {
    return (
        <div className={`app-scroll min-h-0 flex-1 bg-[var(--background)] px-4 py-6 pb-[max(1.5rem,calc(1.5rem+env(safe-area-inset-bottom,0px)))] transition-colors duration-150 sm:px-6 sm:py-8 lg:px-8 lg:py-10 ${className}`}>
            <main className="mx-auto w-full max-w-6xl">{children}</main>
        </div>
    );
}
