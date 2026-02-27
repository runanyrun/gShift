"use client";

import { FormEvent, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { AuthCardLayout, AuthFooterLink } from "../../components/auth/AuthCardLayout";

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
    <AuthCardLayout
      title="Create account"
      description="Create your company workspace and start setup in minutes."
      footer={<AuthFooterLink href="/login" label="Sign in" text="Already have an account?" />}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="signup-company">Company name</Label>
          <Input
            id="signup-company"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            type="text"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="signup-first">First name (optional)</Label>
          <Input id="signup-first" value={firstName} onChange={(event) => setFirstName(event.target.value)} type="text" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="signup-last">Last name (optional)</Label>
          <Input id="signup-last" value={lastName} onChange={(event) => setLastName(event.target.value)} type="text" />
        </div>
        {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating..." : "Create account"}
        </Button>
      </form>
    </AuthCardLayout>
  );
}
