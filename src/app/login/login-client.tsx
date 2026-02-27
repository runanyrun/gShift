"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailPassword } from "../../lib/auth-client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { AuthCardLayout, AuthFooterLink } from "../../components/auth/AuthCardLayout";

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
      const message = submitError instanceof Error ? submitError.message : "Unexpected login error.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCardLayout
      title="Sign in"
      description="Access your workspace dashboard, schedules, and reports."
      footer={<AuthFooterLink href="/signup" label="Create one" text="No account yet?" />}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </AuthCardLayout>
  );
}
