"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "../../core/db/supabase";

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspace = searchParams.get("workspace");
  const next = searchParams.get("next") || (workspace ? `/dashboard?workspace=${encodeURIComponent(workspace)}` : "/dashboard");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      const accessToken = data.session?.access_token;
      const expiresAt = data.session?.expires_at;
      if (!accessToken || !expiresAt) {
        throw new Error("Auth session missing.");
      }

      const maxAge = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
      document.cookie = `sb_access_token=${accessToken}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;

      router.replace(next);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Unexpected login error.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Login</h1>
      <form onSubmit={onSubmit}>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          placeholder="Email"
          required
        />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          placeholder="Password"
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {error ? <p>{error}</p> : null}
    </main>
  );
}
