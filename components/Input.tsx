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
  onKeyDown,
}: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-semibold text-[var(--text-primary)]">
          {label}
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
        className={`w-full min-h-[44px] sm:min-h-[40px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-base sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] shadow-sm transition-colors duration-150 focus:border-[var(--focus)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]/20 disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-secondary)] disabled:cursor-not-allowed ${className || ""}`}
      />
    </div>
  );
}
