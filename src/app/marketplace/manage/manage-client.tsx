"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "../../../core/db/supabase";

interface ManagePost {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  ends_at: string;
}

interface ApplicationItem {
  applicationId: string;
  workerUserId: string;
  status: string;
  createdAt: string;
}

export function MarketplaceManageClientPage() {
  const [posts, setPosts] = useState<ManagePost[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) ?? null,
    [posts, selectedPostId],
  );

  async function withToken<T>(fn: (token: string) => Promise<T>): Promise<T> {
    const supabase = createBrowserSupabaseClient();
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session?.access_token) {
      throw new Error("Auth session missing.");
    }
    return fn(data.session.access_token);
  }

  const loadPosts = async () => {
    const body = await withToken(async (token) => {
      const response = await fetch("/api/marketplace/manage/posts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as { ok: boolean; data?: ManagePost[]; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Failed to load management posts.");
      }
      return payload.data ?? [];
    });
    setPosts(body);
    setSelectedPostId((current) => current ?? body[0]?.id ?? null);
  };

  const loadApplications = async (postId: string) => {
    const body = await withToken(async (token) => {
      const response = await fetch(`/api/marketplace/posts/${postId}/applications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as { ok: boolean; data?: ApplicationItem[]; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Failed to load applications.");
      }
      return payload.data ?? [];
    });
    setApplications(body);
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    loadPosts()
      .catch((loadError) => {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load posts.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedPostId) {
      setApplications([]);
      return;
    }
    loadApplications(selectedPostId).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load applications.");
    });
  }, [selectedPostId]);

  async function accept(postId: string, workerUserId: string) {
    setError(null);
    try {
      await withToken(async (token) => {
        const response = await fetch(`/api/marketplace/posts/${postId}/accept`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ workerUserId }),
        });
        const payload = (await response.json()) as { ok: boolean; error?: string };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to accept application.");
        }
      });
      await loadPosts();
      await loadApplications(postId);
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Failed to accept application.");
    }
  }

  return (
    <main>
      <h1>Marketplace Manage</h1>
      {loading ? <p>Loading...</p> : null}
      {error ? <p>{error}</p> : null}
      <section>
        <h2>Posts</h2>
        <ul>
          {posts.map((post) => (
            <li key={post.id}>
              <button type="button" onClick={() => setSelectedPostId(post.id)}>
                {post.title} ({post.status})
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Applications {selectedPost ? `for ${selectedPost.title}` : ""}</h2>
        {!selectedPost ? <p>Select a post.</p> : null}
        {selectedPost && applications.length === 0 ? <p>No applications.</p> : null}
        <ul>
          {applications.map((app) => (
            <li key={app.applicationId}>
              <p>{app.workerUserId}</p>
              <p>
                {app.status} / {app.createdAt}
              </p>
              <button type="button" onClick={() => void accept(selectedPost!.id, app.workerUserId)}>
                Kabul et
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
