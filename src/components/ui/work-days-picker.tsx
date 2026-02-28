"use client";

import { Button } from "./button";
import { DAY_KEYS, type DayKey, normalizeWorkingDays } from "../../lib/schedule-prefs";

const DAY_LABELS: Record<DayKey, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

type Preset = {
  key: "weekdays" | "weekends" | "all";
  label: string;
  days: DayKey[];
};

const PRESETS: Preset[] = [
  { key: "weekdays", label: "Weekdays", days: ["mon", "tue", "wed", "thu", "fri"] },
  { key: "weekends", label: "Weekends", days: ["sat", "sun"] },
  { key: "all", label: "All", days: [...DAY_KEYS] },
];

type WorkDaysPickerProps = {
  value: DayKey[];
  onChange: (days: DayKey[]) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
  helperText?: string;
};

export function WorkDaysPicker({
  value,
  onChange,
  disabled = false,
  allowEmpty = false,
  helperText,
}: WorkDaysPickerProps) {
  const selected = normalizeWorkingDays(allowEmpty ? value : value.length > 0 ? value : DAY_KEYS);

  function toggle(day: DayKey) {
    if (disabled) {
      return;
    }

    const exists = selected.includes(day);
    const next = exists ? selected.filter((item) => item !== day) : [...selected, day];

    if (!allowEmpty && next.length === 0) {
      return;
    }

    onChange(normalizeWorkingDays(next));
  }

  function applyPreset(days: DayKey[]) {
    if (disabled) {
      return;
    }

    onChange(normalizeWorkingDays(days));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const active = preset.days.length === selected.length && preset.days.every((day) => selected.includes(day));
          return (
            <Button
              key={preset.key}
              type="button"
              variant={active ? "default" : "outline"}
              className="h-8 px-3 text-xs"
              disabled={disabled}
              onClick={() => applyPreset(preset.days)}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {DAY_KEYS.map((day) => {
          const active = selected.includes(day);
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => toggle(day)}
              className={`inline-flex h-9 min-w-11 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              {DAY_LABELS[day]}
            </button>
          );
        })}
      </div>

      {helperText ? <p className="text-xs text-slate-500">{helperText}</p> : null}
    </div>
  );
}
