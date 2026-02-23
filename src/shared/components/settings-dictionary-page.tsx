"use client";

import { FormEvent, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "../../core/db/supabase";

interface DictionaryItem {
  id: string;
  name: string;
  isActive: boolean;
}

interface SettingsDictionaryPageProps {
  title: string;
  endpoint: string;
}

export function SettingsDictionaryPage({ title, endpoint }: SettingsDictionaryPageProps) {
  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function authorizedFetch(path: string, init?: RequestInit) {
    const supabase = createBrowserSupabaseClient();
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session?.access_token) {
      throw new Error("Auth session missing.");
    }
    return fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
        ...(init?.headers ?? {}),
      },
    });
  }

  async function load() {
    try {
      const response = await authorizedFetch(endpoint, { method: "GET" });
      const body = (await response.json()) as {
        ok: boolean;
        data?: Array<{ id: string; name: string; isActive: boolean }>;
        error?: string;
      };
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? `Failed to load ${title}.`);
      }
      setItems(body.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : `Failed to load ${title}.`);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [endpoint]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const response = await authorizedFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ name, isActive: true }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? `Failed to create ${title} item.`);
      }
      setName("");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Create request failed.");
    }
  }

  async function onToggle(item: DictionaryItem) {
    setError(null);
    try {
      const response = await authorizedFetch(`${endpoint}/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? `Failed to update ${title} item.`);
      }
      await load();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Update request failed.");
    }
  }

  return (
    <div>
      <h1>{title}</h1>
      {error ? <p>{error}</p> : null}

      <form onSubmit={onCreate}>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <button type="submit">Add</button>
      </form>

      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.name} ({item.isActive ? "active" : "inactive"}){" "}
            <button type="button" onClick={() => onToggle(item)}>
              Toggle Active
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
