import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1714" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "SupportAI | AI Customer Support",
    template: "%s | SupportAI",
  },
  description:
    "Resolve customer questions instantly with an AI assistant trained on your knowledge base.",
  applicationName: "SupportAI",
  referrer: "strict-origin-when-cross-origin",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "SupportAI",
    title: "SupportAI | AI Customer Support",
    description:
      "Resolve customer questions instantly with an AI assistant trained on your knowledge base.",
  },
  twitter: {
    card: "summary",
    title: "SupportAI | AI Customer Support",
    description:
      "Resolve customer questions instantly with an AI assistant trained on your knowledge base.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--text-primary)] transition-colors duration-150">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
