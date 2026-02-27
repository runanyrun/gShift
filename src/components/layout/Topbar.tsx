"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMe } from "../../core/auth/useMe";
import { getNavItemsForPermissions, resolvePageTitleFromPath } from "../../features/navigation/nav-model";
import { signOut } from "../../lib/auth-client";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { NotificationsBell } from "../notifications/NotificationsBell";
import { Plus, ChevronDown, Menu } from "lucide-react";

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me } = useMe();
  const navItems = getNavItemsForPermissions(me?.permissions);

  const userLabel = useMemo(() => {
    const name = me?.user?.name?.trim();
    if (name) return name;
    const email = me?.user?.email?.trim();
    if (email) return email;
    return "Me";
  }, [me?.user?.email, me?.user?.name]);

  const userInitials = useMemo(() => {
    const name = me?.user?.name?.trim();
    if (name) {
      const parts = name.split(" ");
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    const email = me?.user?.email?.trim();
    if (email) return email.slice(0, 2).toUpperCase();
    return "ME";
  }, [me?.user?.email, me?.user?.name]);

  async function onSignOut() {
    try {
      await signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        {/* Left: mobile menu + page title */}
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 md:hidden">
              <Menu className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {navItems.map((item) => (
                <DropdownMenuItem key={item.href} onSelect={() => router.push(item.href)}>
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="hidden md:block">
            <h1 className="text-sm font-semibold text-slate-900">
              {resolvePageTitleFromPath(pathname, me?.permissions)}
            </h1>
          </div>
        </div>

        {/* Right: actions + user */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="hidden sm:inline-flex"
            onClick={() => router.push("/schedule")}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Shift
          </Button>

          <NotificationsBell />

          <div className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                {userInitials}
              </div>
              <span className="hidden max-w-[120px] truncate text-sm font-medium text-slate-700 sm:block">
                {userLabel}
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium text-slate-900">{userLabel}</p>
                <p className="text-[11px] text-slate-500">{me?.tenant?.name ?? "Workspace"}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push("/settings/company")}>
                Company settings
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/onboarding")}>
                Onboarding
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => void onSignOut()}
                className="text-red-600 focus:text-red-600"
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
