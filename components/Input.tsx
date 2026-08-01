type InputProps = {
  label?: string;
  type?: string;
  id: string;
  placeholder?: string;
  value: string;
  className?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function Input({
  label = "",
  type = "text",
  id,
  placeholder,
  value,
  onChange,
  className
}: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}

      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors duration-150 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${className || ""}`}
      />
    </div>
  );
}