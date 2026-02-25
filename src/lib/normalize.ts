export function normalizeName(name: string): string {
  return name.trim();
}

export function normalizeRate(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}
