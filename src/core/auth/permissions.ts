export type PermissionInput =
  | string[]
  | Record<string, boolean | number | string | null | undefined>
  | null
  | undefined;

function toSnakeCase(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .replace(/__+/g, "_")
    .toLowerCase();
}

function normalizePermissionSet(perms: PermissionInput): Set<string> {
  const normalized = new Set<string>();
  if (!perms) {
    return normalized;
  }

  if (Array.isArray(perms)) {
    for (const value of perms) {
      if (typeof value === "string" && value.trim().length > 0) {
        normalized.add(toSnakeCase(value));
      }
    }
    return normalized;
  }

  for (const [key, value] of Object.entries(perms)) {
    if (value) {
      normalized.add(toSnakeCase(key));
    }
  }

  return normalized;
}

export function hasPerm(perms: PermissionInput, key: string): boolean {
  return normalizePermissionSet(perms).has(toSnakeCase(key));
}

export function canManage(perms: PermissionInput): boolean {
  return hasPerm(perms, "administration") || hasPerm(perms, "management");
}
