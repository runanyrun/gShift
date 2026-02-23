import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerAuthenticatedUser } from "../../core/auth/server-session";
import { AppShell } from "../../shared/components/app-shell";

interface ProtectedLayoutProps {
  children: ReactNode;
}

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const user = await getServerAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
