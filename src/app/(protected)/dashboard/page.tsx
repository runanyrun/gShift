"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../../core/db/supabase";
import { DashboardBootstrapPayload } from "../../../features/dashboard/types/dashboard.types";

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardBootstrapPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
      document.cookie = "sb_access_token=; Path=/; Max-Age=0; SameSite=Lax";
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    const supabase = createBrowserSupabaseClient();

    supabase.auth
      .getSession()
      .then(async ({ data, error: sessionError }) => {
        if (sessionError) {
          throw sessionError;
        }

        const accessToken = data.session?.access_token;
        if (!accessToken) {
          throw new Error("Auth session missing.");
        }

        return fetch("/api/dashboard/bootstrap", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
      })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? "Failed to load dashboard bootstrap.");
        }

        return (await response.json()) as DashboardBootstrapPayload;
      })
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setData(payload);
      })
      .catch((fetchError) => {
        if (!mounted) {
          return;
        }
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Unexpected dashboard bootstrap error.";
        setError(message);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return <div>{error}</div>;
  }

  if (!data) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div>
      <h1>{data.company.name}</h1>
      <button type="button" onClick={onSignOut} disabled={signingOut}>
        {signingOut ? "Signing out..." : "Sign out"}
      </button>
      <p>
        Role: {data.user.role} | Users: {data.metrics.usersCount}
      </p>
      <p>
        Timezone: {data.company.timezone ?? "not-set"} | Currency:{" "}
        {data.company.currencyCode ?? "not-set"}
      </p>
    </div>
  );
}
