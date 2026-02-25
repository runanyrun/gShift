"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMe } from "../../core/auth/useMe";
import { signOut } from "../../lib/auth-client";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Separator } from "../ui/separator";

function titleFromPath(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me } = useMe();

  const userLabel = useMemo(() => {
    const name = me?.user?.name?.trim();
    if (name) {
      return name;
    }
    const email = me?.user?.email?.trim();
    if (email) {
      return email;
    }
    return "Me";
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
        <p className="text-sm font-semibold text-slate-900">{titleFromPath(pathname)}</p>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" className="gap-2 px-3">
            <span aria-hidden="true">🔔</span>
            <Badge variant="destructive" className="h-2 w-2 rounded-full p-0 text-[0px]">
              dot
            </Badge>
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <DropdownMenu>
            <div className="relative">
              <DropdownMenuTrigger className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50">
                {userLabel}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5 text-xs text-slate-600">{userLabel}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push("/settings/company")}>Company settings</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push("/onboarding")}>Onboarding</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void onSignOut()}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </div>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
