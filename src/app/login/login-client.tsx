"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailPassword } from "../../lib/auth-client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { AuthFooterLink } from "../../components/auth/AuthCardLayout";
import { AuthMarketingLayout } from "../../components/auth/AuthMarketingLayout";

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspace = searchParams.get("workspace");
  const next = searchParams.get("next") || (workspace ? `/?workspace=${encodeURIComponent(workspace)}` : "/");

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
    <AuthMarketingLayout
      title="Welcome back"
      description="Sign in to your workspace to continue."
      footer={<AuthFooterLink href="/signup" label="Create one" text="No account yet?" />}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Email address</Label>
          <Input
            id="login-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>
        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : null}
        <Button type="submit" disabled={loading} className="w-full" size="lg">
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </AuthMarketingLayout>
  );
}
