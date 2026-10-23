type ButtonProps = {
  children: React.ReactNode;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  "aria-label"?: string;
  variant?: "primary" | "secondary" | "tertiary" | "danger";
};

export default function Button({
  children,
  type = "button",
  disabled = false,
  loading = false,
  onClick,
  className,
  "aria-label": ariaLabel,
  variant = "primary",
}: ButtonProps) {
  const isEffectivelyDisabled = disabled || loading;

  const variants = {
    primary:
      "bg-[var(--accent)] text-white shadow-sm hover:brightness-95 active:brightness-90",
    secondary:
      "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-2xs hover:bg-[var(--surface-muted)] active:bg-[var(--surface-muted)]",
    tertiary:
      "bg-transparent text-[var(--accent-link)] hover:bg-[var(--accent-soft)] active:bg-[var(--accent-soft)]",
    danger:
      "bg-[var(--error)] text-white shadow-sm hover:brightness-95 active:brightness-90",
  };

  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-semibold transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-secondary)] disabled:shadow-none disabled:brightness-100 disabled:opacity-75 disabled:active:scale-100 ${variants[variant]} ${className || ""}`}
      type={type}
      disabled={isEffectivelyDisabled}
      aria-busy={loading ? "true" : undefined}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {loading && (
        <svg
          className="mr-2 h-4 w-4 animate-spin-slow shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            opacity="0.25"
          />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
