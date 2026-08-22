"use client";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputStyles =
    "w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-150";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/";
  };

  return (
    <div className="min-h-screen flex justify-center items-center flex-col gap-6 bg-slate-50 px-4 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] bg-teal-500/[0.04] rounded-full blur-[100px]" />
        <div className="absolute -bottom-32 -left-32 w-[28rem] h-[28rem] bg-teal-500/[0.03] rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-[400px] p-7 sm:p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-7 bg-white animate-fade-in-up relative z-10">
        <header className="flex flex-col gap-2.5 items-center text-center">
          <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center mb-1">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed max-w-[260px]">
            Log in to your AI Customer Support Platform account.
          </p>
        </header>

        <form className="flex flex-col" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <Input
              label="Email"
              id="email"
              type="email"
              placeholder="name@company.com"
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

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5">
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500/20 cursor-pointer transition-all"
                />
                <span className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors">
                  Remember me
                </span>
              </label>
              <a
                href="#"
                className="text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors"
              >
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-1 w-full py-2.5"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin-slow w-4 h-4 mr-2"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      opacity="0.25"
                    />
                    <path
                      d="M12 2a10 10 0 0 1 10 10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                  Logging in…
                </>
              ) : (
                "Log in"
              )}
            </Button>
          </div>
        </form>

        <footer className="text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-teal-600 hover:text-teal-700 font-semibold transition-colors"
          >
            Get started
          </Link>
        </footer>
      </div>

      <p className="text-[11px] text-slate-400 relative z-10 tracking-wide">
        Protected by industry-standard encryption
      </p>
    </div>
  );
}