"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { AuthCardLayout } from "../../components/auth/AuthCardLayout";
import { useMe } from "../../core/auth/useMe";
import { createBrowserSupabaseClient } from "../../core/db/supabase";

type InviteAcceptState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; code: string; message: string };

export function AcceptInviteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const workspace = searchParams.get("workspace") ?? "";
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [state, setState] = useState<InviteAcceptState>({ status: "idle" });
  const { refresh } = useMe();
  const autoAttemptedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    const supabase = createBrowserSupabaseClient();
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          setIsLoggedIn(Boolean(data.session?.access_token));
        }
      })
      .catch(() => {
        if (mounted) {
          setIsLoggedIn(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function acceptInvite() {
    setState({ status: "loading" });
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session?.access_token) {
        throw new Error("Please sign in first.");
      }
      const response = await fetch("/api/invites/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ token }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: { employeeId: string; tenantId: string };
        error?: string | { code?: string; message?: string };
      };
      if (!response.ok || !body.ok) {
        const errorCode = typeof body.error === "object" ? body.error?.code ?? "unknown" : "unknown";
        const errorMessage = typeof body.error === "string" ? body.error : body.error?.message ?? "Invite acceptance failed.";
        setState({ status: "error", code: errorCode, message: errorMessage });
        return;
      }
      await refresh();
      setState({ status: "success", message: "Invite accepted. Your employee profile is now linked." });
    } catch (acceptError) {
      setState({
        status: "error",
        code: "unknown",
        message: acceptError instanceof Error ? acceptError.message : "Invite acceptance failed.",
      });
    }
  }

  useEffect(() => {
    if (!token || !isLoggedIn || state.status !== "idle" || autoAttemptedRef.current) {
      return;
    }
    autoAttemptedRef.current = true;
    void acceptInvite();
  }, [isLoggedIn, state.status, token]);

  const loginNext = workspace
    ? `/accept-invite?token=${encodeURIComponent(token)}&workspace=${encodeURIComponent(workspace)}`
    : `/accept-invite?token=${encodeURIComponent(token)}`;
  const loginHref = `/login?next=${encodeURIComponent(loginNext)}${workspace ? `&workspace=${encodeURIComponent(workspace)}&reason=invite` : "&reason=invite"}`;
  const dashboardHref = workspace ? `/dashboard?workspace=${encodeURIComponent(workspace)}` : "/dashboard";

  return (
    <AuthCardLayout title="Accept invite" description="Join your workspace and connect your employee profile.">
      {!token ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Invite token is missing.</p> : null}

      {!isLoggedIn ? (
        <p className="text-sm text-slate-700">
          You need to sign in before accepting this invite.{" "}
          <Link href={loginHref} className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4">
            Go to sign in
          </Link>
        </p>
      ) : (
        <Button type="button" disabled={!token || state.status === "loading"} onClick={() => void acceptInvite()} className="w-full">
          {state.status === "loading" ? "Accepting..." : "Accept invite"}
        </Button>
      )}

      {state.status === "success" ? (
        <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3">
          <p className="text-sm text-emerald-700">{state.message}</p>
          <Button type="button" variant="outline" onClick={() => router.push(dashboardHref)}>
            Go to dashboard
          </Button>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="space-y-2 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
          {state.code === "user-already-in-company" ? (
            <>
              <p>This account is already linked to another workspace.</p>
              <p>{state.message}</p>
              <p>
                <Link
                  href={workspace ? `/login?workspace=${encodeURIComponent(workspace)}&reason=invite` : "/login"}
                  className="font-medium text-red-800 underline underline-offset-4"
                >
                  Sign in with a different account
                </Link>
              </p>
            </>
          ) : state.code === "invite-invalid" ? (
            <p>Invite not found.</p>
          ) : state.code === "invite-expired" ? (
            <p>Invite has expired.</p>
          ) : (
            <p>{state.message}</p>
          )}
        </div>
      ) : null}
    </AuthCardLayout>
  );
}
