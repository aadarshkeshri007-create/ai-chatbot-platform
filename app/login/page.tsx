"use client";
import Button from "@/components/Button";
import Input from "@/components/Input";
import AuthLayout from "@/components/AuthLayout";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createLoginRequest } from "@/lib/auth/login-request";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputStyles =
    "w-full min-h-[44px] sm:min-h-[40px] border border-[var(--border)] rounded-lg px-3.5 py-2.5 text-base sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]/20 focus:border-[var(--focus)] transition-all duration-150 dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--text-primary)] dark:placeholder:text-[var(--text-secondary)] dark:focus:border-[var(--focus)]";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const request = createLoginRequest(email.trim(), password);
      const response = await fetch(request.url, request.init);
      const result = await response.json() as { ok?: boolean; error?: string };

      if (!response.ok || !result.ok) {
        setError(result.error ?? "Unable to sign in. Check your email and password and try again.");
        return;
      }

      router.refresh();
      router.push("/chat");
    } catch {
      setError("An unexpected error occurred during sign-in. Please try again.");
    } finally {
      setPassword("");
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="flex w-full flex-col gap-7">
        <header className="flex flex-col gap-2 text-left">
          <p className="workspace-kicker">Sign in</p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            Welcome back
          </h1>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            Sign in to continue to your support workspace.
          </p>
        </header>

        <form className="flex flex-col" method="post" action="/api/auth/login" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <Input
              label="Email"
              id="email"
              name="email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputStyles}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-[var(--text-primary)] dark:text-[var(--text-secondary)]">
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
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-secondary)] dark:text-[var(--text-secondary)] dark:hover:text-slate-200 transition-colors focus:outline-none"
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
              <div className="flex items-start gap-2 rounded-lg bg-[var(--error-soft)] border border-red-100 px-3 py-2.5 dark:bg-[var(--error-soft)] dark:border-[color-mix(in_srgb,var(--error)_35%,var(--border))]">
                <svg className="w-4 h-4 text-[var(--error)] mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <p className="text-sm text-[var(--error)] dark:text-[var(--error)]">{error}</p>
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
        <Link href="/forgot-password" className="mt-1 text-sm font-medium text-[var(--accent-link)] hover:underline">
          Forgot password?
        </Link>

        <footer className="flex flex-col gap-4 text-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)] dark:border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[var(--background)] px-2 text-[var(--text-secondary)] dark:bg-[var(--background)] dark:text-[var(--text-secondary)]">
                New to SupportAI?
              </span>
            </div>
          </div>

          <p className="text-xs text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-[var(--accent-link)] hover:text-[var(--accent-link)] dark:text-[var(--accent-link)] dark:hover:text-teal-300 font-medium transition-colors"
            >
              Create an account
            </Link>
          </p>
        </footer>
      </div>

    </AuthLayout>
  );
}
