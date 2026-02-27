"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailPassword } from "../../lib/auth-client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { AuthFooterLink } from "../../components/auth/AuthCardLayout";
import { AuthMarketingLayout } from "../../components/auth/AuthMarketingLayout";
import { fetchMe } from "../../core/auth/useMe";
import { resolvePostLoginRoute } from "../../core/auth/post-login-routing";

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspace = searchParams.get("workspace");
  const next = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await signInWithEmailPassword(email, password);
      if (!data.userId) {
        throw new Error("Auth session missing.");
      }

      const me = await fetchMe(true);
      const roleAwareRoute = resolvePostLoginRoute(me);
      const isSafeRelativeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//");
      const target = isSafeRelativeNext ? next : workspace ? `/?workspace=${encodeURIComponent(workspace)}` : roleAwareRoute;
      router.replace(target);
      router.refresh();
    } catch (submitError) {
      console.error("Login submit failed", submitError);
      const message = submitError instanceof Error ? submitError.message : "Unexpected login error.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthMarketingLayout
      title="Sign in"
      description="Use your work email to access schedules, approvals, and reports."
      forgotPasswordDisabled
      footer={<AuthFooterLink href="/signup" label="Create one" text="No account yet?" />}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Email address</Label>
          <Input
            id="login-email"
            data-testid="auth-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="name@company.com"
            autoComplete="email"
            required
          />
          <p className="text-xs text-slate-500">Use your company email address.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            data-testid="auth-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
          <p className="text-xs text-slate-500">Minimum 8 characters.</p>
        </div>
        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <p data-testid="auth-error" className="text-sm text-red-700">{error}</p>
          </div>
        ) : null}
        <Button data-testid="auth-submit" type="submit" disabled={loading} className="w-full" size="lg">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
              Signing in...
            </span>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
    </AuthMarketingLayout>
  );
}
