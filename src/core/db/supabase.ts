import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import { Database } from "./database.types";

export type TypedSupabaseClient = SupabaseClient<Database>;

export function createSupabaseClient(): TypedSupabaseClient {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
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
