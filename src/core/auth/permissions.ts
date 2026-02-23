export function hasPerm(perms: string[], key: string): boolean {
  return perms.includes(key);
}

export function canManage(perms: string[]): boolean {
  return hasPerm(perms, "administration") || hasPerm(perms, "management");
}
