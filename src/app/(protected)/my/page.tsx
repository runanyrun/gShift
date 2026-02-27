"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { resolvePostLoginRoute } from "../../../core/auth/post-login-routing";
import { useMe } from "../../../core/auth/useMe";

export default function MyDashboardPage() {
  const router = useRouter();
  const { data: me, loading } = useMe();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!me) {
      router.replace("/login");
      return;
    }

    router.replace(resolvePostLoginRoute(me));
  }, [loading, me, router]);

  return <div>Redirecting...</div>;
}
