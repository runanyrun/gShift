"use client";

import { useEffect, useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Label } from "../../../../components/ui/label";
import { Select } from "../../../../components/ui/select";

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

type CompanySettings = {
  id: string;
  name: string;
  locale: string;
  currency: string;
  warning?: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }

  return body.data as T;
}

export default function CompanySettingsPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [locale, setLocale] = useState("tr-TR");
  const [currency, setCurrency] = useState("TRY");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const dirty = settings ? (locale !== (settings.locale ?? "tr-TR") || currency !== (settings.currency ?? "TRY")) : true;

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchJson<CompanySettings>("/api/company/settings");
        if (!mounted) {
          return;
        }

        setSettings(data);
        setLocale(data.locale ?? "tr-TR");
        setCurrency(data.currency ?? "TRY");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Failed to load company settings");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSuccess(null);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [success]);

  async function onSave() {
    setSaving(true);
    setError(null);

    try {
      const data = await fetchJson<CompanySettings>("/api/company/settings", {
        method: "PATCH",
        body: JSON.stringify({ locale, currency }),
      });

      setSettings(data);
      setLocale(data.locale ?? "tr-TR");
      setCurrency(data.currency ?? "TRY");
      setSuccess(data.warning ? "Saved (limited mode)" : "Saved");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save company settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-600">Loading company settings...</div>;
  }

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Company Settings</h1>
        {settings?.name ? <p className="text-sm text-slate-600">{settings.name}</p> : null}
      </header>

      {settings?.warning ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-semibold">Settings are in limited mode</p>
          <p>Locale/currency not persisted yet.</p>
          <p className="text-xs text-amber-800">{settings.warning}</p>
        </div>
      ) : null}

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="company-locale">Locale</Label>
            <Select id="company-locale" value={locale} onChange={(event) => setLocale(event.target.value)}>
              <option value="tr-TR">tr-TR</option>
              <option value="en-US">en-US</option>
              <option value="ar-EG">ar-EG</option>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="company-currency">Currency</Label>
            <Select id="company-currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EGP">EGP</option>
            </Select>
          </div>
        </div>

        <div className="mt-4">
          <Button type="button" onClick={() => void onSave()} disabled={saving || !dirty}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </section>
  );
}
