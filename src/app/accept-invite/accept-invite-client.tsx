"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { AuthMarketingLayout } from "../../components/auth/AuthMarketingLayout";
import { EmptyState } from "../../components/common/EmptyState";
import { useMe } from "../../core/auth/useMe";

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
  const [checkingSession, setCheckingSession] = useState(true);
  const [state, setState] = useState<InviteAcceptState>({ status: "idle" });
  const { refresh } = useMe();
  const autoAttemptedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    void fetch("/api/me", {
      method: "GET",
      credentials: "include",
    })
      .then((response) => {
        if (mounted) {
          setIsLoggedIn(response.ok);
          setCheckingSession(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsLoggedIn(false);
          setCheckingSession(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function acceptInvite() {
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/invites/accept", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
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
  const inviteInvalid = state.status === "error" && (state.code === "invite-invalid" || state.code === "invite-expired");

  return (
    <AuthMarketingLayout
      title="Accept invite"
      description="Confirm your invite to connect your employee profile to this workspace."
    >
      {!token ? (
        <EmptyState
          title="Invite token is missing"
          description="Open the full invite URL from your email, then try again."
          action={
            <Link href="/login" className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4">
              Go to sign in
            </Link>
          }
        />
      ) : null}

      {checkingSession && token ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Checking your session...
        </div>
      ) : null}

      {!checkingSession && token && !isLoggedIn ? (
        <p className="text-sm text-slate-700">
          You need to sign in before accepting this invite.{" "}
          <Link href={loginHref} className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4">
            Go to sign in
          </Link>
        </p>
      ) : null}

      {!checkingSession && token && isLoggedIn ? (
        <Button type="button" disabled={!token || state.status === "loading"} onClick={() => void acceptInvite()} className="w-full">
          {state.status === "loading" ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
              Accepting...
            </span>
          ) : (
            "Accept invite"
          )}
        </Button>
      ) : null}

      {state.status === "success" ? (
        <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3">
          <p className="text-sm text-emerald-700">{state.message}</p>
          <Button type="button" variant="outline" onClick={() => router.push(dashboardHref)}>
            Go to dashboard
          </Button>
        </div>
      ) : null}

      {inviteInvalid ? (
        <EmptyState
          title={state.code === "invite-expired" ? "This invite has expired" : "This invite is invalid"}
          description="Request a new invite from your manager, then sign in to continue."
          action={
            <Link href={workspace ? `/login?workspace=${encodeURIComponent(workspace)}` : "/login"} className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4">
              Go to sign in
            </Link>
          }
        />
      ) : null}

      {state.status === "error" && !inviteInvalid ? (
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
    </AuthMarketingLayout>
  );
}
