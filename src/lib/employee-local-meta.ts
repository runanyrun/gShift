import { DEFAULT_WORKING_DAYS, type DayKey, normalizeWorkingDays } from "./schedule-prefs";

export type EmployeeLocalMeta = {
  email: string;
  phone: string;
  portalAccessEnabled: boolean;
  primaryRoleLabel: string;
  additionalRolesText: string;
  availabilityDays: DayKey[];
  payMode: "hourly" | "daily" | "salary";
  payAmount: string;
  startDate: string;
  defaultBreakMinutes: string;
};

const STORAGE_KEY = "qshift.employee-local-meta.v1";

const DEFAULT_META: EmployeeLocalMeta = {
  email: "",
  phone: "",
  portalAccessEnabled: false,
  primaryRoleLabel: "",
  additionalRolesText: "",
  availabilityDays: [...DEFAULT_WORKING_DAYS],
  payMode: "hourly",
  payAmount: "",
  startDate: "",
  defaultBreakMinutes: "",
};

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeMeta(raw: Partial<EmployeeLocalMeta> | null | undefined): EmployeeLocalMeta {
  return {
    email: raw?.email ?? "",
    phone: raw?.phone ?? "",
    portalAccessEnabled: raw?.portalAccessEnabled ?? false,
    primaryRoleLabel: raw?.primaryRoleLabel ?? "",
    additionalRolesText: raw?.additionalRolesText ?? "",
    availabilityDays: normalizeWorkingDays(raw?.availabilityDays),
    payMode: raw?.payMode === "daily" || raw?.payMode === "salary" ? raw.payMode : "hourly",
    payAmount: raw?.payAmount ?? "",
    startDate: raw?.startDate ?? "",
    defaultBreakMinutes: raw?.defaultBreakMinutes ?? "",
  };
}

export function getDefaultEmployeeLocalMeta(): EmployeeLocalMeta {
  return { ...DEFAULT_META, availabilityDays: [...DEFAULT_WORKING_DAYS] };
}

export function readEmployeeLocalMetaMap(): Record<string, EmployeeLocalMeta> {
  if (!isBrowser()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, Partial<EmployeeLocalMeta>>;
    const normalized: Record<string, EmployeeLocalMeta> = {};

    for (const [key, value] of Object.entries(parsed)) {
      normalized[key] = normalizeMeta(value);
    }

    return normalized;
  } catch {
    return {};
  }
}

export function readEmployeeLocalMeta(id: string): EmployeeLocalMeta {
  return readEmployeeLocalMetaMap()[id] ?? getDefaultEmployeeLocalMeta();
}

export function writeEmployeeLocalMeta(id: string, value: EmployeeLocalMeta) {
  if (!isBrowser()) {
    return;
  }

  const current = readEmployeeLocalMetaMap();
  current[id] = normalizeMeta(value);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}
