"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailPassword } from "../../lib/auth";

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
      const data = await signInWithEmailPassword(email, password);
      if (!data.session) {
        throw new Error("Auth session missing.");
      }

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
