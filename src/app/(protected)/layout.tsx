import { ReactNode } from "react";
import { AuthGuard } from "../../core/auth/AuthGuard";

interface ProtectedLayoutProps {
  children: ReactNode;
}

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  return <AuthGuard>{children}</AuthGuard>;
}
