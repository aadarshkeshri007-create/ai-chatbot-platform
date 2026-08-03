"use client";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const inputStyles =
    "w-full border border-[#E5E3DD] rounded-xl px-4 py-3 text-[15px] bg-[#FAFAF8]/60 text-[#1C1F26] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-[3px] focus:ring-[#0F6E68]/15 focus:border-[#0F6E68] focus:bg-white transition-all duration-200 ease-out";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log(email);
    console.log(password);
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
          <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] bg-[#0F6E68]/[0.04] rounded-full blur-[100px]" />
          <div className="absolute -bottom-32 -left-32 w-[28rem] h-[28rem] bg-[#0F6E68]/[0.03] rounded-full blur-[100px]" />
        </div>

        <div className="w-full max-w-[420px] p-8 sm:p-10 rounded-2xl border border-white/70 shadow-[0_32px_96px_-24px_rgba(15,110,104,0.18),0_8px_24px_-8px_rgba(28,31,38,0.06)] flex flex-col gap-8 bg-white/85 backdrop-blur-2xl animate-fade-in-up relative z-10">
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
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h1 className="text-[1.65rem] font-bold tracking-tight text-[#1C1F26] font-sans leading-tight">
              Welcome back
            </h1>
            <p className="text-sm text-[#6B7280] leading-relaxed max-w-[260px]">
              Log in to your AI Customer Support Platform account.
            </p>
          </header>

          <form className="flex flex-col" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-5">
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

              <div className="flex items-center justify-between -mt-0.5">
                <label className="flex items-center gap-2 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded-md border-[#D1D5DB] text-[#0F6E68] focus:ring-2 focus:ring-[#0F6E68]/20 cursor-pointer transition-all"
                  />
                  <span className="text-[13px] text-[#6B7280] group-hover:text-[#374151] transition-colors">
                    Remember me
                  </span>
                </label>
                <a
                  href="#"
                  className="text-[13px] font-medium text-[#0F6E68] hover:text-[#0A524D] transition-colors"
                >
                  Forgot password?
                </a>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="mt-1 bg-gradient-to-r from-[#0F6E68] to-[#128C82] hover:from-[#0C5A55] hover:to-[#0F6E68] text-white rounded-xl py-3 text-sm font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none shadow-lg shadow-[#0F6E68]/20 hover:shadow-xl hover:shadow-[#0F6E68]/25 hover:-translate-y-[1px] active:translate-y-0 flex items-center justify-center gap-2.5"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin-slow w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        opacity="0.25"
                      />
                      <path
                        d="M12 2a10 10 0 0 1 10 10"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    Logging in...
                  </>
                ) : (
                  "Log in"
                )}
              </Button>
            </div>
          </form>

          <footer className="text-center text-sm text-[#6B7280] pt-1">
            Don&apos;t have an account?{" "}
            <a
              href="#"
              className="text-[#0F6E68] hover:text-[#0A524D] font-semibold transition-colors"
            >
              Get started
            </a>
          </footer>
        </div>

        <p className="text-[11px] text-[#9CA3AF] relative z-10 tracking-wide">
          Protected by industry-standard encryption
        </p>
      </div>
    </>
  );
}