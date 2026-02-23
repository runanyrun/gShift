"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentSession, onSupabaseSessionChange } from "./session";

interface AuthGuardProps {
  children: ReactNode;
  redirectTo?: string;
  fallback?: ReactNode;
}

export function AuthGuard({
  children,
  redirectTo = "/login",
  fallback = null,
}: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    getCurrentSession()
      .then((session) => {
        if (!mounted) {
          return;
        }
        if (session) {
          setIsAuthorized(true);
          return;
        }

        setIsAuthorized(false);
        const target = `${redirectTo}?next=${encodeURIComponent(pathname ?? "/")}`;
        router.replace(target);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }
        setIsAuthorized(false);
        router.replace(redirectTo);
      });

    const unsubscribe = onSupabaseSessionChange((_, session) => {
      if (!mounted) {
        return;
      }
      if (session) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
        router.replace(redirectTo);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [pathname, redirectTo, router]);

  if (isAuthorized !== true) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
