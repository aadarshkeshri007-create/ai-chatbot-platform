import { SidebarProvider } from "@/components/SidebarContext";
import AppShell from "@/components/AppShell";

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
