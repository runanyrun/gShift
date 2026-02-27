import { getSupabaseBrowserClient } from "./supabase-browser";

export async function signInWithEmailPassword(email: string, password: string) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const body = (await response.json()) as {
    ok?: boolean;
    data?: {
      userId?: string;
      accessToken?: string | null;
    };
    error?: { message?: string } | string;
  };

  if (!response.ok || !body.ok || !body.data?.userId) {
    const message =
      typeof body.error === "string"
        ? body.error
        : body.error?.message ?? "Invalid credentials.";
    throw new Error(message);
  }

  return body.data;
}

export async function signOut() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string } | string }
      | null;
    const message =
      typeof body?.error === "string"
        ? body.error
        : body?.error?.message ?? "Failed to sign out.";
    throw new Error(message);
  }
}

export async function getSession() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }
  return data.session;
}
