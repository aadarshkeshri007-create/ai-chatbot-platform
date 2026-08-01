type ButtonProps = {
  children: React.ReactNode;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
};

export default function Button({ children, type = "button", disabled = false, onClick, className }: ButtonProps) {
  return (
    <button className={`rounded-lg p-2 bg-blue-600 hover:bg-blue-700 transition-colors text-white font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed ${className}`} type={type} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}