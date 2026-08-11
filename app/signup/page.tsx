"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
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
        if (score >= 2 && password.length >= 8) return { level: 4, label: "Strong", color: "bg-emerald-500" };
        return { level: 3, label: "Good", color: "bg-teal-400" };
    })();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const supabase = createClient();

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                },
            },
        });

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        setSuccess(true);
        setLoading(false);
    };

    return (
        <>
            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(24px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .animate-fade-in-up {
                    animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .animate-spin-slow {
                    animation: spin 0.8s linear infinite;
                }
            `}</style>

            <div className="min-h-screen flex justify-center items-center flex-col gap-6 bg-gradient-to-br from-[#FAFAF8] via-[#F5F5F2] to-[#EBE8E2] px-4 relative overflow-hidden">
                {/* Ambient background blobs */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute -top-32 -left-32 w-[28rem] h-[28rem] bg-[#0F6E68]/[0.04] rounded-full blur-[100px]" />
                    <div className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] bg-[#0F6E68]/[0.03] rounded-full blur-[100px]" />
                </div>

                <div className="w-full max-w-[420px] p-8 sm:p-10 rounded-2xl border border-white/70 shadow-[0_32px_96px_-24px_rgba(15,110,104,0.18),0_8px_24px_-8px_rgba(28,31,38,0.06)] flex flex-col gap-7 bg-white/85 backdrop-blur-2xl animate-fade-in-up relative z-10">
                    {/* Header */}
                    <header className="flex flex-col gap-3 items-center text-center">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0F6E68] to-[#0A524D] flex items-center justify-center shadow-lg shadow-[#0F6E68]/20 mb-1 ring-4 ring-[#0F6E68]/5">
                            <svg
                                width="22"
                                height="22"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="white"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <line x1="19" y1="8" x2="19" y2="14" />
                                <line x1="22" y1="11" x2="16" y2="11" />
                            </svg>
                        </div>
                        <h1 className="text-[1.65rem] font-bold tracking-tight text-[#1C1F26] font-sans leading-tight">
                            Create your account
                        </h1>
                        <p className="text-sm text-[#6B7280] leading-relaxed max-w-[280px]">
                            Get started with AI-powered customer support in minutes.
                        </p>
                    </header>

                    {/* Success state */}
                    {success ? (
                        <div className="flex flex-col items-center gap-4 py-4">
                            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center ring-4 ring-emerald-100">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 6L9 17l-5-5" />
                                </svg>
                            </div>
                            <div className="text-center">
                                <h2 className="text-lg font-semibold text-[#1C1F26]">Check your email</h2>
                                <p className="mt-2 text-sm text-[#6B7280] leading-relaxed max-w-[300px]">
                                    We&apos;ve sent a confirmation link to <span className="font-medium text-[#1C1F26]">{email}</span>. Click it to activate your account.
                                </p>
                            </div>
                            <Link
                                href="/login"
                                className="mt-2 text-sm font-semibold text-[#0F6E68] hover:text-[#0A524D] transition-colors"
                            >
                                Go to login →
                            </Link>
                        </div>
                    ) : (
                        <>
                            {/* Form */}
                            <form className="flex flex-col" onSubmit={handleSignup}>
                                <div className="flex flex-col gap-4">
                                    {/* Full Name */}
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="name" className="text-sm font-medium text-[#374151]">
                                            Full name
                                        </label>
                                        <input
                                            id="name"
                                            type="text"
                                            placeholder="Jane Smith"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full border border-[#E5E3DD] rounded-xl px-4 py-3 text-[15px] bg-[#FAFAF8]/60 text-[#1C1F26] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-[3px] focus:ring-[#0F6E68]/15 focus:border-[#0F6E68] focus:bg-white transition-all duration-200 ease-out"
                                        />
                                    </div>

                                    {/* Email */}
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="signup-email" className="text-sm font-medium text-[#374151]">
                                            Work email
                                        </label>
                                        <input
                                            id="signup-email"
                                            type="email"
                                            placeholder="name@company.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="w-full border border-[#E5E3DD] rounded-xl px-4 py-3 text-[15px] bg-[#FAFAF8]/60 text-[#1C1F26] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-[3px] focus:ring-[#0F6E68]/15 focus:border-[#0F6E68] focus:bg-white transition-all duration-200 ease-out"
                                        />
                                    </div>

                                    {/* Password */}
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="signup-password" className="text-sm font-medium text-[#374151]">
                                            Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                id="signup-password"
                                                type={showPassword ? "text" : "password"}
                                                placeholder="Min. 8 characters"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                minLength={6}
                                                className="w-full border border-[#E5E3DD] rounded-xl px-4 py-3 pr-11 text-[15px] bg-[#FAFAF8]/60 text-[#1C1F26] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-[3px] focus:ring-[#0F6E68]/15 focus:border-[#0F6E68] focus:bg-white transition-all duration-200 ease-out"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                                                aria-label={showPassword ? "Hide password" : "Show password"}
                                            >
                                                {showPassword ? (
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                                        <line x1="1" y1="1" x2="23" y2="23" />
                                                    </svg>
                                                ) : (
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                                                                    : "bg-[#E5E3DD]"
                                                            }`}
                                                        />
                                                    ))}
                                                </div>
                                                <span className={`text-[11px] font-medium ${
                                                    passwordStrength.level <= 1 ? "text-red-500"
                                                    : passwordStrength.level === 2 ? "text-amber-500"
                                                    : passwordStrength.level === 3 ? "text-teal-600"
                                                    : "text-emerald-600"
                                                }`}>
                                                    {passwordStrength.label}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Error message */}
                                    {error && (
                                        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3.5 py-2.5">
                                            <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="15" y1="9" x2="9" y2="15" />
                                                <line x1="9" y1="9" x2="15" y2="15" />
                                            </svg>
                                            <p className="text-sm text-red-700">{error}</p>
                                        </div>
                                    )}

                                    {/* Terms notice */}
                                    <p className="text-[12px] text-[#9CA3AF] leading-relaxed -mt-0.5">
                                        By creating an account, you agree to our{" "}
                                        <a href="#" className="text-[#0F6E68] hover:text-[#0A524D] underline underline-offset-2 transition-colors">Terms of Service</a>
                                        {" "}and{" "}
                                        <a href="#" className="text-[#0F6E68] hover:text-[#0A524D] underline underline-offset-2 transition-colors">Privacy Policy</a>.
                                    </p>

                                    {/* Submit */}
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-gradient-to-r from-[#0F6E68] to-[#128C82] hover:from-[#0C5A55] hover:to-[#0F6E68] text-white rounded-xl py-3 text-sm font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none shadow-lg shadow-[#0F6E68]/20 hover:shadow-xl hover:shadow-[#0F6E68]/25 hover:-translate-y-[1px] active:translate-y-0 flex items-center justify-center gap-2.5 cursor-pointer"
                                    >
                                        {loading ? (
                                            <>
                                                <svg
                                                    className="animate-spin-slow w-4 h-4"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                >
                                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5" opacity="0.25" />
                                                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                                                </svg>
                                                Creating account...
                                            </>
                                        ) : (
                                            "Create account"
                                        )}
                                    </button>
                                </div>
                            </form>

                            {/* Footer */}
                            <footer className="text-center text-sm text-[#6B7280] pt-1">
                                Already have an account?{" "}
                                <Link
                                    href="/login"
                                    className="text-[#0F6E68] hover:text-[#0A524D] font-semibold transition-colors"
                                >
                                    Log in
                                </Link>
                            </footer>
                        </>
                    )}
                </div>

                <p className="text-[11px] text-[#9CA3AF] relative z-10 tracking-wide">
                    Protected by industry-standard encryption
                </p>
            </div>
        </>
    );
}