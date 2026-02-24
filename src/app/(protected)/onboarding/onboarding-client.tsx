"use client";

import Link from "next/link";
import { canManage } from "../../../core/auth/permissions";
import { useMe } from "../../../core/auth/useMe";

interface OnboardingClientProps {
  token?: string;
}

export default function OnboardingClient({ token }: OnboardingClientProps) {
  const { data: me, loading } = useMe();

  if (loading) {
    return <p>Loading onboarding...</p>;
  }

  const inviteHref = token
    ? `/accept-invite?token=${encodeURIComponent(token)}`
    : "/accept-invite?token=...";

  if (me?.tenant && !me.employee) {
    const tenantName = me.tenant.name ?? me.tenant.id;
    const showCreateEmployee = canManage(me.permissions);

    return (
      <>
        <p>
          You&apos;re connected to {tenantName}, but your user is not linked to an employee record yet.
        </p>
        <p>
          {showCreateEmployee ? (
            <Link href="/employees/new">Create employee</Link>
          ) : (
            <Link href={inviteHref}>Enter invite token</Link>
          )}
        </p>
        <p>
          <Link href="/dashboard">Retry</Link>
        </p>
      </>
    );
  }

  const defaultInviteHref = token
    ? `/accept-invite?token=${encodeURIComponent(token)}`
    : "/accept-invite";

  return (
    <>
      <p>You&apos;re not connected to a company yet.</p>
      <p>Ask your manager to invite you.</p>
      <p>
        <Link href={defaultInviteHref}>{token ? "Continue invite" : "Go to invite page"}</Link>
      </p>
      <p>
        <Link href="/dashboard">Retry</Link>
      </p>
    </>
  );
}
