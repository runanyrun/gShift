"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "../../core/auth/useMe";
import { getNavItemsForPermissions } from "../../features/navigation/nav-model";
import {
  LayoutDashboard,
  Calendar,
  BarChart2,
  Bell,
  Users,
  Settings,
  Zap,
  Briefcase,
  Search,
} from "lucide-react";

const NAV_ICONS: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  schedule: Calendar,
  reports: BarChart2,
  notifications: Bell,
  employees: Users,
  settings: Settings,
  setup: Zap,
  jobs: Briefcase,
  "find-jobs": Search,
};

function isActive(pathname: string, href: string) {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();
  const { data: me } = useMe();
  const navItems = getNavItemsForPermissions(me?.permissions);

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-slate-950 md:flex">
      <div className="sticky top-0 flex h-screen flex-col">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-800 px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-tight text-white">gShift</span>
        </div>

        {/* Navigation */}
        <nav aria-label="Primary" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = NAV_ICONS[item.id] ?? LayoutDashboard;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`nav-${item.id}`}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.5 : 2} />
                <span>{item.label}</span>
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white opacity-75" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Workspace info */}
        <div className="border-t border-slate-800 px-3 py-3">
          <div className="rounded-lg bg-slate-900 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Workspace</p>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-300">
              {me?.tenant?.name ?? "Loading..."}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
