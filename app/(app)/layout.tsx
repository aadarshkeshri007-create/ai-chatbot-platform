import type { Metadata } from "next";
import { SidebarProvider } from "@/components/SidebarContext";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
    title: "Workspace",
    robots: {
        index: false,
        follow: false,
    },
};

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SidebarProvider>
            <AppShell>{children}</AppShell>
        </SidebarProvider>
    );
}
