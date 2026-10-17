import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SupportAI chat",
  description: "Embedded SupportAI customer chat.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function WidgetFrameLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
