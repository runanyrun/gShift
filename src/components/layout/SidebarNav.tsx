"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/employees", label: "Employees" },
  { href: "/schedule", label: "Schedule" },
  { href: "/reports", label: "Reports" },
  { href: "/settings/company", label: "Settings" },
];

function isActive(pathname: string, href: string) {
  if (pathname === href) {
    return true;
  }
  return pathname.startsWith(`${href}/`);
}

function linkClasses(active: boolean) {
  const base = "block rounded-md px-3 py-2 text-sm font-medium transition-colors";
  if (active) {
    return `${base} bg-slate-900 text-white`;
  }
  return `${base} text-slate-700 hover:bg-slate-100 hover:text-slate-900`;
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="md:hidden" aria-label="Primary">
        <div className="mb-4 flex flex-wrap gap-2">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={linkClasses(isActive(pathname, item.href))}>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:block">
        <div className="sticky top-0 p-4">
          <p className="mb-4 px-1 text-sm font-semibold tracking-wide text-slate-900">gShift</p>
          <nav aria-label="Primary" className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className={linkClasses(isActive(pathname, item.href))}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
