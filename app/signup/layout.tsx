import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create a SupportAI account and build an AI assistant for your customers.",
  alternates: { canonical: "/signup" },
};

export default function SignupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
