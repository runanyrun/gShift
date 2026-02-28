export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type DayKey = (typeof DAY_KEYS)[number];

export type SchedulePrefs = {
  workingDays: DayKey[];
};

export const DEFAULT_WORKING_DAYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

const STORAGE_KEY = "qshift.schedule-prefs.v1";

function isBrowser() {
  return typeof window !== "undefined";
}

function uniqueDays(days: readonly DayKey[]): DayKey[] {
  const seen = new Set<DayKey>();
  const ordered: DayKey[] = [];

  for (const day of DAY_KEYS) {
    if (days.includes(day) && !seen.has(day)) {
      seen.add(day);
      ordered.push(day);
    }
  }

  return ordered;
}

export function normalizeWorkingDays(days: readonly string[] | null | undefined): DayKey[] {
  if (!days || days.length === 0) {
    return [...DEFAULT_WORKING_DAYS];
  }

  const filtered = days.filter((day): day is DayKey => DAY_KEYS.includes(day as DayKey));
  const normalized = uniqueDays(filtered);
  return normalized.length > 0 ? normalized : [...DEFAULT_WORKING_DAYS];
}

export function readSchedulePrefs(): SchedulePrefs {
  if (!isBrowser()) {
    return { workingDays: [...DEFAULT_WORKING_DAYS] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { workingDays: [...DEFAULT_WORKING_DAYS] };
    }

    const parsed = JSON.parse(raw) as { workingDays?: string[] } | null;
    return {
      workingDays: normalizeWorkingDays(parsed?.workingDays),
    };
  } catch {
    return { workingDays: [...DEFAULT_WORKING_DAYS] };
  }
}

export function writeSchedulePrefs(prefs: SchedulePrefs) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      workingDays: normalizeWorkingDays(prefs.workingDays),
    }),
  );
}
