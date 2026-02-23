"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { resolvePostLoginRoute } from "../../../core/auth/post-login-routing";
import { useMe } from "../../../core/auth/useMe";

export default function MyDashboardPage() {
  const router = useRouter();
  const { data: me, loading } = useMe();
  const target = me ? resolvePostLoginRoute(me) : null;

  const employeeName = useMemo(() => {
    if (!me?.employee) {
      return "Employee";
    }
    return `${me.employee.first_name} ${me.employee.last_name}`.trim();
  }, [me]);

  useEffect(() => {
    if (target && target !== "/my") {
      router.replace(target);
    }
  }, [router, target]);

  if (loading || !me) {
    return <div>Loading dashboard...</div>;
  }

  if (target !== "/my") {
    return <div>Redirecting...</div>;
  }

  return (
    <main>
      <h1>My Dashboard</h1>
      <p>
        {employeeName} @ {me.tenant?.name ?? me.tenant?.id ?? "Unknown tenant"}
      </p>
      <nav>
        <Link href="/employees">Employee Directory</Link> | <Link href="/dashboard">Try Admin Dashboard</Link>
      </nav>

      <section>
        <h2>My Shifts (Next 7 days)</h2>
        <p>Shift timeline coming soon. TODO: connect tenant-safe shift query for employee self view.</p>
      </section>

      <section>
        <h2>Time Off</h2>
        <p>Time off summary is coming soon.</p>
      </section>
    </main>
  );
}
