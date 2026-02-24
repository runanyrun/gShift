"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "../../core/db/supabase";

interface MarketplacePost {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
}

export function MarketplaceClientPage() {
  const [posts, setPosts] = useState<MarketplacePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session?.access_token) {
          throw new Error("Auth session missing.");
        }

        const response = await fetch("/api/marketplace/posts", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        const body = (await response.json()) as { ok: boolean; data?: MarketplacePost[]; error?: string };
        if (!response.ok || !body.ok) {
          throw new Error(body.error ?? "Failed to load marketplace posts.");
        }
        if (mounted) {
          setPosts(body.data ?? []);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load marketplace posts.");
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

  async function apply(postId: string) {
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session?.access_token) {
        throw new Error("Auth session missing.");
      }

      const response = await fetch(`/api/marketplace/posts/${postId}/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({}),
      });
      const body = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Failed to apply.");
      }
      setApplied((current) => ({ ...current, [postId]: true }));
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Failed to apply.");
    }
  }

  return (
    <main>
      <h1>Marketplace</h1>
      {loading ? <p>Loading...</p> : null}
      {error ? <p>{error}</p> : null}
      {!loading && posts.length === 0 ? <p>No open posts.</p> : null}
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <p>{post.title}</p>
            <p>
              {post.starts_at} - {post.ends_at}
            </p>
            <button type="button" onClick={() => void apply(post.id)} disabled={Boolean(applied[post.id])}>
              {applied[post.id] ? "Başvuruldu" : "Apply"}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
