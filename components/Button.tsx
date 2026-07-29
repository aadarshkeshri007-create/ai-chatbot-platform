type ButtonProps = {
  text: string;
};

export default function Button({ text }: ButtonProps) {
  return (
     <button className="bg-blue-600 text-white px-6 py-3 rounded-lg">
      {text}
    </button>
  );
}