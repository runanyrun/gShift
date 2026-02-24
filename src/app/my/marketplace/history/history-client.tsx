"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "../../../../core/db/supabase";

interface HistoryRow {
  id: string;
  title: string | null;
  companyName: string | null;
  companySlug: string | null;
  startsAt: string;
  endsAt: string;
  completedAt: string | null;
}

export function MyMarketplaceHistoryClientPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
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
        const response = await fetch("/api/my/marketplace/history", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        const body = (await response.json()) as { ok: boolean; data?: HistoryRow[]; error?: string };
        if (!response.ok || !body.ok) {
          throw new Error(body.error ?? "Failed to load history.");
        }
        if (mounted) {
          setRows(body.data ?? []);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load history.");
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
      <h1>Marketplace History</h1>
      {loading ? <p>Loading...</p> : null}
      {error ? <p>{error}</p> : null}
      {!loading && rows.length === 0 ? <p>History boş.</p> : null}
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            <p>{row.title ?? "Untitled Post"}</p>
            <p>
              {row.companyName ?? "Unknown Company"} ({row.companySlug ?? "no-slug"})
            </p>
            <p>
              {row.startsAt} - {row.endsAt}
            </p>
            <p>Completed: {row.completedAt ?? "-"}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
