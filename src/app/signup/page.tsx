"use client";

import { FormEvent, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { AuthFooterLink } from "../../components/auth/AuthCardLayout";
import { AuthMarketingLayout } from "../../components/auth/AuthMarketingLayout";

interface SignupResponse {
  authUserId: string;
  companyId: string;
  profileId: string;
  requiresEmailVerification: boolean;
  error?: string;
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          companyName,
          firstName: firstName || null,
          lastName: lastName || null,
        }),
      });

      const body = (await response.json()) as SignupResponse;
      if (!response.ok) {
        throw new Error(body.error ?? "Signup failed.");
      }

      if (response.status === 202 || body.requiresEmailVerification) {
        setMessage("Account created. Confirm your email, then continue setup.");
        return;
      }

      setMessage("Account and onboarding created. You can now continue to the dashboard.");
    } catch (submitError) {
      const errorMessage = submitError instanceof Error ? submitError.message : "Unexpected signup error.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthMarketingLayout
      title="Create account"
      description="Create your company workspace and start setup in minutes."
      footer={<AuthFooterLink href="/login" label="Sign in" text="Already have an account?" />}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="signup-email">Work email</Label>
          <Input
            id="signup-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signup-company">Company name</Label>
          <Input
            id="signup-company"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            type="text"
            placeholder="Acme Corp"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="signup-first">First name</Label>
            <Input
              id="signup-first"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              type="text"
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signup-last">Last name</Label>
            <Input
              id="signup-last"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              type="text"
              placeholder="Optional"
            />
          </div>
        </div>
        {message ? (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-sm text-emerald-700">{message}</p>
          </div>
        ) : null}
        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : null}
        <Button type="submit" disabled={loading} className="w-full" size="lg">
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </AuthMarketingLayout>
  );
}
