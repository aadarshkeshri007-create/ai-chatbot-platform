import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to manage your SupportAI customer support assistant.",
  alternates: { canonical: "/login" },
};

export default function LoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
