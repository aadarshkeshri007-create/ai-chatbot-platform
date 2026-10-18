type ButtonProps = {
  children: React.ReactNode;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  "aria-label"?: string;
};

export default function Button({
  children,
  type = "button",
  disabled = false,
  onClick,
  className,
  "aria-label": ariaLabel,
}: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-[44px] sm:min-h-[40px] items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold bg-[var(--accent)] text-white shadow-sm transition-all duration-150 hover:brightness-95 active:scale-[0.98] disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100 ${className || ""}`}
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}