import { canManage as canManagePermissions } from "../../core/auth/permissions";
import { PermissionInput } from "../../core/auth/permissions";

export type NavRole = "manager" | "worker" | "all";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  roles: NavRole[];
};

const BASE_NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", roles: ["all"] },
  { id: "schedule", label: "Schedule", href: "/schedule", roles: ["all"] },
  { id: "reports", label: "Reports", href: "/reports", roles: ["all"] },
  { id: "notifications", label: "Notifications", href: "/notifications", roles: ["all"] },
  { id: "employees", label: "Employees", href: "/employees", roles: ["all"] },
  { id: "settings", label: "Settings", href: "/settings/company", roles: ["all"] },
  { id: "setup", label: "Setup", href: "/onboarding", roles: ["all"] },
];

export function resolveNavRole(permissions: PermissionInput): Exclude<NavRole, "all"> {
  return canManagePermissions(permissions) ? "manager" : "worker";
}

export function getNavItemsForPermissions(permissions: PermissionInput): NavItem[] {
  const role = resolveNavRole(permissions);
  const jobsItem: NavItem = role === "manager"
    ? { id: "jobs", label: "Jobs", href: "/manager/jobs", roles: ["manager"] }
    : { id: "jobs", label: "Find Jobs", href: "/jobs", roles: ["worker"] };

  return [BASE_NAV_ITEMS[0], jobsItem, ...BASE_NAV_ITEMS.slice(1)];
}

export function resolvePageTitleFromPath(pathname: string, permissions: PermissionInput): string {
  const navItems = getNavItemsForPermissions(permissions);
  const active = navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  if (active) {
    return active.label;
  }
  const segment = pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}
