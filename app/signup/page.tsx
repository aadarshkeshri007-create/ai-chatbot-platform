"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthLayout from "@/components/AuthLayout";

export default function SignupPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const passwordStrength = (() => {
        if (password.length === 0) return { level: 0, label: "", color: "" };
        if (password.length < 6) return { level: 1, label: "Weak", color: "bg-red-400" };
        if (password.length < 8) return { level: 2, label: "Fair", color: "bg-amber-400" };
        const hasUpper = /[A-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[^A-Za-z0-9]/.test(password);
        const score = [hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
        if (score >= 2 && password.length >= 8) return { level: 4, label: "Strong", color: "bg-[var(--success)]" };
        return { level: 3, label: "Good", color: "bg-teal-400" };
    })();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const supabase = createClient();

            const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    data: {
                        full_name: name.trim(),
                    },
                },
            });

            if (error) {
                setError("Unable to create your account. Please check your details and try again.");
                setLoading(false);
                return;
            }

            /*
             * If the Supabase project auto-confirms users,
             * a session is returned immediately — go to chat.
             * Otherwise show the "check your email" screen.
             */
            if (data.session) {
                router.refresh();
                router.push("/chat");
                return;
            }

            setSuccess(true);
            setLoading(false);
        } catch {
            setError("An unexpected error occurred during signup. Please try again.");
            setLoading(false);
        }
    };

    const inputStyles =
        "w-full min-h-[44px] sm:min-h-[40px] border border-[var(--border)] rounded-lg px-3.5 py-2.5 text-base sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]/20 focus:border-[var(--focus)] transition-all duration-150 dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--text-primary)] dark:placeholder:text-[var(--text-secondary)] dark:focus:border-[var(--focus)]";

    return (
        <AuthLayout>
            <div className="flex w-full flex-col gap-6">
                {/* Header */}
                <header className="flex flex-col gap-2 text-left">
                    <p className="workspace-kicker">Create your workspace</p>
                    <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                        Create your account
                    </h1>
                    <p className="text-sm leading-6 text-[var(--text-secondary)]">
                        Set up an account to configure your support assistant.
                    </p>
                </header>

                {/* Success state */}
                {success ? (
                    <div className="flex flex-col items-center gap-4 py-4">
                        <div className="w-12 h-12 rounded-full bg-[var(--success-soft)] dark:bg-[var(--success-soft)] flex items-center justify-center ring-4 ring-emerald-100 dark:ring-emerald-900/30">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M20 6L9 17l-5-5" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <h2 className="text-base font-semibold text-[var(--text-primary)] dark:text-[var(--text-primary)]">Check your email</h2>
                            <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed max-w-[300px] dark:text-[var(--text-secondary)]">
                                We&apos;ve sent a confirmation link to <span className="font-medium text-[var(--text-primary)] dark:text-[var(--text-primary)]">{email}</span>. Click it to activate your account.
                            </p>
                        </div>
                        <Link
                            href="/login"
                            className="mt-2 text-sm font-semibold text-[var(--accent-link)] hover:text-[var(--accent-link)] dark:text-[var(--accent-link)] dark:hover:text-teal-300 transition-colors"
                        >
                            Go to login →
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Form */}
                        <form className="flex flex-col" method="post" action="/signup" onSubmit={handleSignup}>
                            <div className="flex flex-col gap-4">
                                {/* Full Name */}
                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor="name" className="text-sm font-medium text-[var(--text-primary)] dark:text-[var(--text-secondary)]">
                                        Full name
                                    </label>
                                    <input
                                        id="name"
                                        type="text"
                                        placeholder="Jane Smith"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className={inputStyles}
                                    />
                                </div>

                                {/* Email */}
                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor="signup-email" className="text-sm font-medium text-[var(--text-primary)] dark:text-[var(--text-secondary)]">
                                        Work email
                                    </label>
                                    <input
                                        id="signup-email"
                                        type="email"
                                        placeholder="name@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className={inputStyles}
                                    />
                                </div>

                                {/* Password */}
                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor="signup-password" className="text-sm font-medium text-[var(--text-primary)] dark:text-[var(--text-secondary)]">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="signup-password"
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Min. 8 characters"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            minLength={6}
                                            autoComplete="new-password"
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

                                    {/* Password strength bar */}
                                    {password.length > 0 && (
                                        <div className="flex items-center gap-2.5 mt-1">
                                            <div className="flex-1 flex gap-1">
                                                {[1, 2, 3, 4].map((i) => (
                                                    <div
                                                        key={i}
                                                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                                            i <= passwordStrength.level
                                                                ? passwordStrength.color
                                                                : "bg-slate-200 dark:bg-[var(--surface-muted)]"
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                            <span className={`text-[11px] font-medium ${
                                                passwordStrength.level <= 1 ? "text-[var(--error)]"
                                                : passwordStrength.level === 2 ? "text-amber-500"
                                                : passwordStrength.level === 3 ? "text-[var(--accent-link)] dark:text-[var(--accent-link)]"
                                                : "text-[var(--success)] dark:text-[var(--success)]"
                                            }`}>
                                                {passwordStrength.label}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Error message */}
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

                                {/* Terms notice */}
                                <p className="text-[12px] text-[var(--text-secondary)] dark:text-[var(--text-secondary)] leading-relaxed">
                                    By creating an account, you acknowledge that
                                    account and assistant data are handled by this
                                    application. Review your organization&apos;s
                                    policies before adding sensitive information.
                                </p>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-[var(--accent)] hover:bg-[var(--accent)] active:bg-teal-800 dark:bg-[var(--accent)] dark:hover:bg-[var(--accent)] text-white rounded-lg py-2.5 text-sm font-semibold transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
                                >
                                    {loading ? (
                                        <>
                                            <svg
                                                className="animate-spin-slow w-4 h-4"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                aria-hidden="true"
                                            >
                                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                                                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                            </svg>
                                            Creating account…
                                        </>
                                    ) : (
                                        "Create account"
                                    )}
                                </button>
                            </div>
                        </form>

                        {/* Footer */}
                        <footer className="text-center text-sm text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
                            Already have an account?{" "}
                            <Link
                                href="/login"
                                className="text-[var(--accent-link)] hover:text-[var(--accent-link)] dark:text-[var(--accent-link)] dark:hover:text-teal-300 font-semibold transition-colors"
                            >
                                Log in
                            </Link>
                        </footer>
                    </>
                )}
            </div>

        </AuthLayout>
    );
}
