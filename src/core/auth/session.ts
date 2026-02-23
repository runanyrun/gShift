"use client";

import {
  AuthChangeEvent,
  Session,
  User,
} from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "../db/supabase";

export type SessionListener = (
  event: AuthChangeEvent,
  session: Session | null,
) => void;

export function onSupabaseSessionChange(
  listener: SessionListener,
): () => void {
  const supabase = createBrowserSupabaseClient();
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(listener);

  return () => {
    subscription.unsubscribe();
  };
}

export async function getCurrentSession(): Promise<Session | null> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Failed to get current session: ${error.message}`);
  }
  return data.session;
}

export async function getCurrentAuthenticatedUser(): Promise<User | null> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(`Failed to get current user: ${error.message}`);
  }
  return data.user;
}
