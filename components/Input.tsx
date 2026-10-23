type InputProps = {
  label?: string;
  type?: string;
  id: string;
  name?: string;
  placeholder?: string;
  value: string;
  className?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

export default function Input({
  label = "",
  type = "text",
  id,
  name,
  placeholder,
  value,
  onChange,
  className,
  disabled = false,
  required = false,
  error,
  onKeyDown,
}: InputProps) {
  const hasError = Boolean(error);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={id}
          className="text-[13px] font-medium text-[var(--text-primary)]"
        >
          {label}
          {required && (
            <span className="ml-1 text-[var(--accent-link)]" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        disabled={disabled}
        required={required}
        aria-invalid={hasError ? "true" : undefined}
        aria-describedby={hasError ? `${id}-error` : undefined}
        className={`w-full min-h-11 rounded-[var(--radius-control)] border bg-[var(--surface)] px-3.5 py-2.5 text-base sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-150 focus:outline-none focus:ring-2 disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-secondary)] disabled:cursor-not-allowed ${
          hasError
            ? "border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]/20"
            : "border-[var(--border)] focus:border-[var(--focus)] focus:ring-[var(--focus)]/20"
        } ${className || ""}`}
      />

      {hasError && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs text-[var(--error)] animate-[fadeInUp_150ms_ease-out]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
