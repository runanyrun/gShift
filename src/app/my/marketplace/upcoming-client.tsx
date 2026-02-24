"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "../../../core/db/supabase";

interface MyAssignment {
  id: string;
  title: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
}

export function MyMarketplaceClientPage() {
  const [rows, setRows] = useState<MyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session?.access_token) {
          throw new Error("Auth session missing.");
        }
        const response = await fetch("/api/my/marketplace/assignments?status=active", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        const body = (await response.json()) as { ok: boolean; data?: MyAssignment[]; error?: string };
        if (!response.ok || !body.ok) {
          throw new Error(body.error ?? "Failed to load assignments.");
        }
        if (mounted) {
          setRows(body.data ?? []);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load assignments.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main>
      <h1>Yaklaşan Marketplace İşlerim</h1>
      {loading ? <p>Loading...</p> : null}
      {error ? <p>{error}</p> : null}
      {!loading && rows.length === 0 ? <p>Aktif iş bulunmuyor.</p> : null}
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            <p>{row.title ?? "Untitled Post"}</p>
            <p>
              {row.startsAt} - {row.endsAt}
            </p>
            <p>Status: {row.status}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
