import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import { Database } from "./database.types";

export type TypedSupabaseClient = SupabaseClient<Database>;

let browserClient: TypedSupabaseClient | null = null;

export function createServerSupabaseClient(): TypedSupabaseClient {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

export function createBrowserSupabaseClient(): TypedSupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  browserClient = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    },
  );

  return browserClient;
}

export function createSupabaseClient(): TypedSupabaseClient {
  if (typeof window === "undefined") {
    return createServerSupabaseClient();
  }

  return createBrowserSupabaseClient();
}

export function createSupabaseClientWithAccessToken(
  accessToken: string,
): TypedSupabaseClient {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
