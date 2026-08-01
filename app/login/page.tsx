"use client";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { useState } from "react";
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const inputStyles =
    "border border-[#E5E3DD] rounded-xl px-3.5 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E68]/30 focus:border-[#0F6E68] transition-colors";
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log(email);
    console.log(password);

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex justify-center items-center flex-col gap-6 bg-[#FAFAF8] px-4">
      <div className="w-full max-w-md p-8 sm:p-10 rounded-2xl border border-[#E5E3DD] shadow-[0_1px_2px_rgba(28,31,38,0.04),0_8px_24px_-8px_rgba(28,31,38,0.08)] flex flex-col gap-8 bg-white">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1F26] font-sans">
            Welcome back
          </h1>
          <p className="text-sm text-left text-[#6B7280]">
            Log in to your AI Customer Support Platform account.
          </p>
        </header>
        <form className="flex flex-col" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-5">
            <Input label="Email"
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputStyles}
            />
            <Input
              label="Password"
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputStyles}
            />
            <Button
              type="submit"
              disabled={loading}
              className="mt-1 bg-[#0F6E68] hover:bg-[#0C5A55] text-white rounded-full py-2.5 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Logging in..." : "Log in"}
            </Button>
          </div>
        </form>
      </div >
    </div >
  );
}