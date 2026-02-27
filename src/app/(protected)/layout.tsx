import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerAuthenticatedUser } from "../../core/auth/server-session";
import { MeProvider } from "../../core/auth/useMe";
import { PageShell } from "../../components/layout/PageShell";
import { SidebarNav } from "../../components/layout/SidebarNav";
import { Topbar } from "../../components/layout/Topbar";

interface ProtectedLayoutProps {
  children: ReactNode;
}

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const user = await getServerAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <MeProvider>
      <div className="flex min-h-screen bg-slate-50">
        <SidebarNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <PageShell>{children}</PageShell>
        </div>
      </div>
    </MeProvider>
  );
}
