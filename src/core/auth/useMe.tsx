"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "../db/supabase";
import { MeResponseData } from "./me.types";

let meCache: MeResponseData | null = null;
let mePromise: Promise<MeResponseData> | null = null;

export async function fetchMe(force = false): Promise<MeResponseData> {
  if (!force && meCache) {
    return meCache;
  }
  if (!force && mePromise) {
    return mePromise;
  }

  mePromise = (async () => {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token ?? null;

    const response = await fetch("/api/me", {
      method: "GET",
      credentials: "include",
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined,
    });
    const body = (await response.json()) as {
      ok: boolean;
      data?: MeResponseData;
      error?: { message?: string } | string;
    };

    if (!response.ok || !body.ok || !body.data) {
      const message =
        typeof body.error === "string"
          ? body.error
          : body.error?.message ?? "Failed to fetch current user info.";
      throw new Error(message);
    }

    meCache = body.data;
    return body.data;
  })();

  try {
    return await mePromise;
  } finally {
    mePromise = null;
  }
}

interface UseMeState {
  data: MeResponseData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function useMeState(): UseMeState {
  const [data, setData] = useState<MeResponseData | null>(meCache);
  const [loading, setLoading] = useState<boolean>(!meCache);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const freshData = await fetchMe(true);
      setData(freshData);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Failed to refresh /api/me.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (meCache) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    fetchMe()
      .then((result) => {
        if (!mounted) {
          return;
        }
        setData(result);
      })
      .catch((fetchError) => {
        if (!mounted) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load /api/me.");
      })
      .finally(() => {
        if (!mounted) {
          return;
        }
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return useMemo(
    () => ({
      data,
      loading,
      error,
      refresh,
    }),
    [data, loading, error],
  );
}

const MeContext = createContext<UseMeState | null>(null);

export function MeProvider({ children }: { children: ReactNode }) {
  const state = useMeState();
  return <MeContext.Provider value={state}>{children}</MeContext.Provider>;
}

export function useMe(): UseMeState {
  const context = useContext(MeContext);
  if (context) {
    return context;
  }
  return useMeState();
}
