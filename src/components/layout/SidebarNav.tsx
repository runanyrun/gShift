"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canManage as canManagePermissions } from "../../core/auth/permissions";
import { useMe } from "../../core/auth/useMe";
import { Badge } from "../ui/badge";

export type NavItem = {
  href: string;
  label: string;
  badge?: string;
};

export function getNavItems(canManage: boolean): NavItem[] {
  return [
    { href: "/dashboard", label: "Dashboard" },
    { href: canManage ? "/manager/jobs" : "/jobs", label: canManage ? "Jobs" : "Find Jobs" },
    { href: "/schedule", label: "Schedule" },
    { href: "/reports", label: "Reports" },
    { href: "/notifications", label: "Notifications" },
    { href: "/employees", label: "Employees" },
    { href: "/settings/company", label: "Settings" },
    { href: "/onboarding", label: "Setup" },
  ];
}

function isActive(pathname: string, href: string) {
  if (pathname === href) {
    return true;
  }
  return pathname.startsWith(`${href}/`);
}

function linkClasses(active: boolean) {
  const base = "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors";
  if (active) {
    return `${base} bg-slate-900 text-white`;
  }
  return `${base} text-slate-700 hover:bg-slate-100 hover:text-slate-900`;
}

export function SidebarNav() {
  const pathname = usePathname();
  const { data: me } = useMe();
  const navItems = getNavItems(canManagePermissions(me?.permissions));

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:block">
      <div className="sticky top-0 p-4">
        <div className="mb-5 flex items-center justify-between px-1">
          <p className="text-sm font-semibold tracking-wide text-slate-900">gShift</p>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            v1
          </Badge>
        </div>
        <nav aria-label="Primary" className="space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={linkClasses(isActive(pathname, item.href))}>
              <span>{item.label}</span>
              {item.badge ? <Badge variant="secondary">{item.badge}</Badge> : null}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
