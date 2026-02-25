"use client";

import { useEffect, useState } from "react";
import { Button } from "../../../../components/ui/button";
import { LimitedModeAlert } from "../../../../components/common/LimitedModeAlert";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Select } from "../../../../components/ui/select";
import { toast } from "../../../../components/ui/sonner";
import { Card, CardContent } from "../../../../components/ui/card";
import { PageHeader } from "../../../../components/layout/PageHeader";

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
  timezone: string;
  week_starts_on: "mon" | "sun";
  default_shift_start: string;
  default_shift_end: string;
  weekly_budget_limit: number | null;
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
  const [timezone, setTimezone] = useState("Europe/Istanbul");
  const [weekStartsOn, setWeekStartsOn] = useState<"mon" | "sun">("mon");
  const [defaultShiftStart, setDefaultShiftStart] = useState("09:00");
  const [defaultShiftEnd, setDefaultShiftEnd] = useState("17:00");
  const [weeklyBudgetLimit, setWeeklyBudgetLimit] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = settings
    ? (
        locale !== (settings.locale ?? "tr-TR")
        || currency !== (settings.currency ?? "TRY")
        || timezone !== (settings.timezone ?? "Europe/Istanbul")
        || weekStartsOn !== (settings.week_starts_on ?? "mon")
        || defaultShiftStart !== (settings.default_shift_start ?? "09:00")
        || defaultShiftEnd !== (settings.default_shift_end ?? "17:00")
        || weeklyBudgetLimit !== (settings.weekly_budget_limit === null ? "" : String(settings.weekly_budget_limit))
      )
    : true;

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
        setTimezone(data.timezone ?? "Europe/Istanbul");
        setWeekStartsOn(data.week_starts_on ?? "mon");
        setDefaultShiftStart(data.default_shift_start ?? "09:00");
        setDefaultShiftEnd(data.default_shift_end ?? "17:00");
        setWeeklyBudgetLimit(data.weekly_budget_limit === null ? "" : String(data.weekly_budget_limit));
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        const message = loadError instanceof Error ? loadError.message : "Failed to load company settings";
        setError(message);
        toast({ title: "Failed to load settings", description: message });
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

  async function onSave() {
    setSaving(true);
    setError(null);

    try {
      const data = await fetchJson<CompanySettings>("/api/company/settings", {
        method: "PATCH",
        body: JSON.stringify({
          locale,
          currency,
          timezone,
          week_starts_on: weekStartsOn,
          default_shift_start: defaultShiftStart,
          default_shift_end: defaultShiftEnd,
          weekly_budget_limit: weeklyBudgetLimit.trim() === "" ? null : Number(weeklyBudgetLimit),
        }),
      });

      setSettings(data);
      setLocale(data.locale ?? "tr-TR");
      setCurrency(data.currency ?? "TRY");
      setTimezone(data.timezone ?? "Europe/Istanbul");
      setWeekStartsOn(data.week_starts_on ?? "mon");
      setDefaultShiftStart(data.default_shift_start ?? "09:00");
      setDefaultShiftEnd(data.default_shift_end ?? "17:00");
      setWeeklyBudgetLimit(data.weekly_budget_limit === null ? "" : String(data.weekly_budget_limit));
      toast(data.warning ? "Saved (limited mode)" : "Saved");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to save company settings";
      setError(message);
      toast({ title: "Failed to save", description: message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-600">Loading company settings...</div>;
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Company Settings"
        description={settings?.name ?? "Configure locale, currency, and timezone defaults."}
      />

      {settings?.warning ? (
        <LimitedModeAlert
          warning={settings.warning}
          message="Locale/currency/timezone/schedule prefs not persisted yet."
        />
      ) : null}

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Card>
        <CardContent className="p-4">
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

            <div className="space-y-1">
              <Label htmlFor="company-timezone">Timezone</Label>
              <Input
                id="company-timezone"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                placeholder="Europe/Istanbul"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="company-week-start">Week starts on</Label>
              <Select
                id="company-week-start"
                value={weekStartsOn}
                onChange={(event) => setWeekStartsOn(event.target.value === "sun" ? "sun" : "mon")}
              >
                <option value="mon">Monday</option>
                <option value="sun">Sunday</option>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="company-default-shift-start">Default shift start</Label>
              <Input
                id="company-default-shift-start"
                type="time"
                value={defaultShiftStart}
                onChange={(event) => setDefaultShiftStart(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="company-default-shift-end">Default shift end</Label>
              <Input
                id="company-default-shift-end"
                type="time"
                value={defaultShiftEnd}
                onChange={(event) => setDefaultShiftEnd(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="company-weekly-budget-limit">Weekly budget limit (optional)</Label>
              <Input
                id="company-weekly-budget-limit"
                type="number"
                min={0}
                step="0.01"
                value={weeklyBudgetLimit}
                onChange={(event) => setWeeklyBudgetLimit(event.target.value)}
                placeholder="10000"
              />
            </div>
          </div>

          <div className="mt-4">
            <Button type="button" onClick={() => void onSave()} disabled={saving || !dirty}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
