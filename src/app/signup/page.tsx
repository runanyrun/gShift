"use client";

import { FormEvent, useState } from "react";

interface SignupResponse {
  authUserId: string;
  companyId: string;
  profileId: string;
  requiresEmailVerification: boolean;
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          companyName,
          firstName: firstName || null,
          lastName: lastName || null,
        }),
      });

      const body = (await response.json()) as SignupResponse & { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Signup failed.");
      }

      if (response.status === 202 || body.requiresEmailVerification) {
        setMessage(
          "Hesap oluşturuldu. E-posta doğrulamasını tamamladıktan sonra onboarding devam edecek.",
        );
        return;
      }

      setMessage("Kayıt ve onboarding tamamlandı. Dashboard'a geçebilirsiniz.");
    } catch (submitError) {
      const errorMessage =
        submitError instanceof Error ? submitError.message : "Unexpected signup error.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Sign up</h1>
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
        <input
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          type="text"
          placeholder="Company name"
          required
        />
        <input
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          type="text"
          placeholder="First name"
        />
        <input
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          type="text"
          placeholder="Last name"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>
      {message ? <p>{message}</p> : null}
      {error ? <p>{error}</p> : null}
    </main>
  );
}
