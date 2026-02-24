"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) {
          return;
        }
        setIsLoggedIn(Boolean(data.session?.access_token));
      })
      .catch(() => {
        if (!mounted) {
          return;
        }
        setIsLoggedIn(false);
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
        throw new Error("Please login first.");
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
        error?:
          | string
          | {
              code?: string;
              message?: string;
            };
      };
      if (!response.ok || !body.ok) {
        const errorCode = typeof body.error === "object" ? body.error?.code ?? "unknown" : "unknown";
        const errorMessage =
          typeof body.error === "string"
            ? body.error
            : body.error?.message ?? "Invite acceptance failed.";
        setState({
          status: "error",
          code: errorCode,
          message: errorMessage,
        });
        return;
      }
      await refresh();
      setState({
        status: "success",
        message: "Invite accepted. Your employee profile is linked.",
      });
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
  const loginHref =
    `/login?next=${encodeURIComponent(loginNext)}` +
    (workspace ? `&workspace=${encodeURIComponent(workspace)}&reason=invite` : "&reason=invite");

  const dashboardHref = workspace
    ? `/dashboard?workspace=${encodeURIComponent(workspace)}`
    : "/dashboard";

  return (
    <div>
      <h1>Accept Invite</h1>
      {!token ? <p>Davet bulunamadı (token eksik).</p> : null}
      {!isLoggedIn ? (
        <p>
          You must login first.{" "}
          <Link href={loginHref}>
            Go to login
          </Link>
        </p>
      ) : (
        <div>
          <button type="button" disabled={!token || state.status === "loading"} onClick={acceptInvite}>
            {state.status === "loading" ? "Accepting..." : "Accept Invite"}
          </button>
        </div>
      )}

      {state.status === "success" ? (
        <div>
          <p>{state.message}</p>
          <button type="button" onClick={() => router.push(dashboardHref)}>
            Dashboard&apos;a git
          </button>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div>
          {state.code === "user-already-in-company" ? (
            <div>
              <p>Bu hesap başka bir workspace&apos;e bağlı.</p>
              <p>{state.message}</p>
              <p>
                <Link href={workspace ? `/login?workspace=${encodeURIComponent(workspace)}&reason=invite` : "/login"}>
                  Farklı hesapla giriş yap
                </Link>
              </p>
              <p>
                <Link href="/dashboard">Mevcut workspace&apos;ime git</Link>
              </p>
            </div>
          ) : null}
          {state.code === "invite-invalid" ? <p>Davet bulunamadı.</p> : null}
          {state.code === "invite-expired" ? <p>Davet süresi doldu.</p> : null}
          {!["user-already-in-company", "invite-invalid", "invite-expired"].includes(state.code) ? (
            <p>{state.message}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
