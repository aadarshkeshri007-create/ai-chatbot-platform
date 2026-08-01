import Link from "next/link";
export default function Sidebar() {
  return (
    <aside className="w-64 border-r-2 border-gray-300 flex flex-col gap-4 p-4">
      <header>
        AI Customer Support
      </header>
      <nav className="flex flex-col gap-2">
        <button className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">New Chat</button>
        <Link className="bg-gray-200 text-gray-800 p-2 rounded hover:bg-gray-300" href="/history">
          Chat History
        </Link>
        <Link className="bg-gray-200 text-gray-800 p-2 rounded hover:bg-gray-300" href="/upload">
          Upload Documents
        </Link>
      </nav>
      <div className="flex justify-between mt-auto">
        <Link className="bg-gray-200 text-gray-800 p-2 rounded hover:bg-gray-300" href="/settings">
          Settings
        </Link>
        <Link className="bg-gray-200 text-gray-800 p-2 rounded hover:bg-gray-300" href="/profile">
          Profile
        </Link>
      </div>
    </aside>
  );
}