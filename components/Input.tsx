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
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[#1C1F26]">
          {label}
        </label>
      )}

      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`border border-gray-300 rounded-lg p-2 text-[#1C1F26] placeholder:text-gray-400 bg-white ${className || ""}`}
      />
    </div>
  );
}