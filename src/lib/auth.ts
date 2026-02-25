import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { HttpError } from "./http";

type CookieStoreLike = {
  getAll: () => Array<{ name: string; value: string }>;
  set: (name: string, value: string, options?: CookieOptions) => void;
};

function requireEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function getServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = cookies() as unknown as CookieStoreLike;
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        for (const { name, value, options } of cookiesToSet) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Cookies can be read-only in some server contexts.
          }
        }
      },
    },
  });
}

export async function requireUser(supabase: SupabaseClient): Promise<User> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new HttpError(401, "Unauthorized");
  }

  return user;
}

export async function requireCompanyId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.rpc("my_company_id");

  if (error) {
    throw new HttpError(400, error.message);
  }

  const companyId = typeof data === "string" ? data : null;
  if (!companyId) {
    throw new HttpError(403, "No company found for current user");
  }

  return companyId;
}
