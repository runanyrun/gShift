"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMe } from "../../core/auth/useMe";
import { createBrowserSupabaseClient } from "../../core/db/supabase";

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { refresh } = useMe();

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
    setResult(null);
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
      const body = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Invite acceptance failed.");
      }
      await refresh();
      setResult("Invite accepted. Your employee profile is linked.");
    } catch (acceptError) {
      setResult(acceptError instanceof Error ? acceptError.message : "Invite acceptance failed.");
    }
  }

  return (
    <div>
      <h1>Accept Invite</h1>
      {!token ? <p>Invite token is missing.</p> : null}
      {!isLoggedIn ? (
        <p>
          You must login first.{" "}
          <Link href={`/login?next=${encodeURIComponent(`/accept-invite?token=${token}`)}`}>
            Go to login
          </Link>
        </p>
      ) : (
        <button type="button" disabled={!token} onClick={acceptInvite}>
          Accept Invite
        </button>
      )}
      {result ? <p>{result}</p> : null}
    </div>
  );
}
