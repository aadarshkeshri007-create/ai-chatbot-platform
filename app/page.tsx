import Link from "next/link";

export default function Home() {
  return (
    <div className="p-10 space-y-4 flex flex-col min-h-screen justify-center items-center">
      <h1 className="text-3xl font-bold">
        AI Customer Support Platform
      </h1>
      <p className="text-lg text-center">
        Manage customer support with AI.
      </p>
      <div className="gap-10 flex flex-row justify-center border-2 border-gray-300 p-4 rounded-lg">
        <Link
          href="/login"
          className="text-blue-600 block"
        >
          Login
        </Link>

        <Link
          href="/dashboard"
          className="text-blue-600 block"
        >
          Dashboard
        </Link>

        <Link
          href="/chat"
          className="text-blue-600 block "
        >
          AI Chat
        </Link>
      </div>
    </div>
    
  );
}
