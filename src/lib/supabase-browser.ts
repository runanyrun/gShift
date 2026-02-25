import { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "../core/db/supabase";

let singleton: SupabaseClient<any> | null = null;

export function getSupabaseBrowserClient(): SupabaseClient<any> {
  if (singleton) {
    return singleton;
  }
  singleton = createBrowserSupabaseClient() as unknown as SupabaseClient<any>;
  return singleton;
}
