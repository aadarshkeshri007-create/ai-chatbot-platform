"use client";
import Button from "@/components/Button";
import Input from "@/components/Input";
import ThemeToggle from "@/components/ThemeToggle";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputStyles =
    "w-full min-h-[44px] sm:min-h-[40px] border border-slate-200 rounded-lg px-3.5 py-2.5 text-base sm:text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-150 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-400";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError("Unable to sign in. Check your email and password and try again.");
        setLoading(false);
        return;
      }

      if (!data?.session) {
        setError(
          "Sign-in succeeded but no active session was established. Please confirm your email if required."
        );
        setLoading(false);
        return;
      }

      // Safe non-sensitive diagnostic check in development
      if (process.env.NODE_ENV !== "production") {
        console.log("[Auth Debug] Sign-in succeeded:", {
          hasUser: !!data.user,
          hasSession: !!data.session,
          hasAuthCookie:
            typeof document !== "undefined" && document.cookie.includes("sb-"),
        });
      }

      // Verify session is active in client before redirecting
      const { data: sessionData } = await supabase.auth.getSession();
      if (process.env.NODE_ENV !== "production") {
        console.log("[Auth Debug] Client session verification:", {
          persisted: !!sessionData?.session,
        });
      }

      router.refresh();
      router.push("/chat");
    } catch (err: unknown) {
      console.error("[Auth Debug] Unexpected sign-in error:", err);
      setError("An unexpected error occurred during sign-in. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex justify-center items-center flex-col gap-6 bg-slate-50 px-4 relative overflow-hidden dark:bg-slate-950 transition-colors duration-150">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <ThemeToggle />
      </div>

      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] bg-teal-500/[0.04] rounded-full blur-[100px] dark:bg-teal-500/[0.08]" />
        <div className="absolute -bottom-32 -left-32 w-[28rem] h-[28rem] bg-teal-500/[0.03] rounded-full blur-[100px] dark:bg-teal-500/[0.06]" />
      </div>

      <div className="w-full max-w-[400px] p-5 sm:p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-7 bg-white animate-fade-in-up relative z-10 dark:border-slate-800 dark:bg-slate-900">
        <header className="flex flex-col gap-2.5 items-center text-center">
          <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center mb-1 shadow-sm">
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
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Welcome back
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed max-w-[260px] dark:text-slate-400">
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
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className={`${inputStyles} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  onPointerDown={(e) => e.preventDefault()}
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition-colors focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 dark:bg-red-950/40 dark:border-red-900/50">
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full mt-1"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin-slow h-4 w-4 text-white"
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
                      opacity="0.3"
                    />
                    <path
                      d="M12 2a10 10 0 0 1 10 10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                  Signing in…
                </div>
              ) : (
                "Sign in"
              )}
            </Button>
          </div>
        </form>

        <footer className="flex flex-col gap-4 text-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                New to SupportAI?
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 font-medium transition-colors"
            >
              Create an account
            </Link>
          </p>
        </footer>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-400 relative z-10 dark:text-slate-500">
        <Link href="/" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}