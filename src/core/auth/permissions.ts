export type PermissionInput =
  | string[]
  | Record<string, unknown>
  | null
  | undefined;

export function normalizePermissionKey(key: string): string {
  if (typeof key !== "string") {
    return "";
  }

  const trimmed = key.trim();
  if (trimmed.length === 0) {
    return "";
  }

  const hasExplicitSeparators = /[^A-Za-z0-9]/.test(trimmed);
  const camelLike =
    /^[a-z]+(?:[A-Z][a-z0-9]{2,})+$/.test(trimmed) ||
    /^[A-Z][a-z0-9]{2,}(?:[A-Z][a-z0-9]{2,})+$/.test(trimmed);
  const source = hasExplicitSeparators || camelLike ? trimmed : trimmed.toLowerCase();

  return source
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function normalizePermissions(input: PermissionInput): Record<string, boolean> {
  if (!input || typeof input !== "object") {
    return {};
  }

  const normalized: Record<string, boolean> = {};

  if (Array.isArray(input)) {
    for (const key of input) {
      if (typeof key !== "string") {
        continue;
      }
      const normalizedKey = normalizePermissionKey(key);
      if (!normalizedKey) {
        continue;
      }
      normalized[normalizedKey] = true;
    }
    return normalized;
  }

  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = normalizePermissionKey(key);
    if (!normalizedKey) {
      continue;
    }
    const nextValue = value === true;
    normalized[normalizedKey] = Boolean(normalized[normalizedKey] || nextValue);
  }

  return normalized;
}

export function hasPerm(input: PermissionInput, permKey: string): boolean {
  if (typeof permKey !== "string" || permKey.trim().length === 0) {
    return false;
  }

  const normalized = normalizePermissions(input);
  const normalizedPermKey = normalizePermissionKey(permKey);
  if (!normalizedPermKey) {
    return false;
  }

  return normalized[normalizedPermKey] === true;
}

export function canManage(input: PermissionInput): boolean {
  return hasPerm(input, "administration") || hasPerm(input, "management");
}

export function permissionsLoaded(input: PermissionInput): boolean {
  return input !== null && input !== undefined;
}
