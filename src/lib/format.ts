export type AppFormatConfig = {
  locale: string;
  currency: string;
  timeZone?: string;
};

export const DEFAULT_FORMAT: AppFormatConfig = {
  locale: "tr-TR",
  currency: "TRY",
};

export function resolveFormatConfig(company?: {
  locale?: string | null;
  currency?: string | null;
  timeZone?: string | null;
}): AppFormatConfig {
  return {
    locale: company?.locale || DEFAULT_FORMAT.locale,
    currency: company?.currency || DEFAULT_FORMAT.currency,
    ...(company?.timeZone ? { timeZone: company.timeZone } : {}),
  };
}

export function ensureNumber(input: number | string | null | undefined): number {
  const value = typeof input === "number" ? input : Number(input ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function safeDate(input: Date | string): Date {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? new Date() : input;
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function makeFormatters(cfg: AppFormatConfig) {
  const numberFormatter = new Intl.NumberFormat(cfg.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const currencyFormatter = new Intl.NumberFormat(cfg.locale, {
    style: "currency",
    currency: cfg.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const dateFormatter = new Intl.DateTimeFormat(cfg.locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(cfg.timeZone ? { timeZone: cfg.timeZone } : {}),
  });

  const timeFormatter = new Intl.DateTimeFormat(cfg.locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(cfg.timeZone ? { timeZone: cfg.timeZone } : {}),
  });

  function formatNumber(n: number): string {
    return numberFormatter.format(ensureNumber(n));
  }

  function formatCurrency(n: number): string {
    return currencyFormatter.format(ensureNumber(n));
  }

  function formatDateDisplay(date: Date | string): string {
    return dateFormatter.format(safeDate(date));
  }

  function formatTimeHM(date: Date | string): string {
    return timeFormatter.format(safeDate(date));
  }

  function toCsvNumber(n: number): string {
    return formatNumber(n);
  }

  return {
    formatNumber,
    formatCurrency,
    formatDateDisplay,
    formatTimeHM,
    toCsvNumber,
  };
}

// TODO: Later load this config from company settings (e.g. company.locale/company.currency via /api/me).
