"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { notificationDescription, notificationHref, NotificationRow, notificationTitle } from "../../features/notifications/notification-links";
import { formatRelativeTime } from "../../features/notifications/relative-time";

type NotificationPayload = {
  items: NotificationRow[];
  unread_count: number;
};

export function NotificationsBell() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NotificationPayload>({ items: [], unread_count: 0 });
  const [now, setNow] = useState(() => new Date());

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const body = (await response.json()) as { ok: boolean; data?: T; error?: string };
    if (!response.ok || !body.ok) {
      throw new Error(body.error ?? `Request failed: ${response.status}`);
    }
    return body.data as T;
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchJson<NotificationPayload>("/api/notifications?limit=8");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 30000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  async function markRead(id: string) {
    try {
      await fetchJson(`/api/notifications/${id}/read`, { method: "POST" });
      await load();
    } catch {
      // no-op
    }
  }

  async function markAllRead() {
    try {
      await fetchJson("/api/notifications/read-all", { method: "POST" });
      await load();
    } catch {
      // no-op
    }
  }

  async function openNotification(notification: NotificationRow) {
    if (!notification.read_at) {
      await markRead(notification.id);
    }
    router.push(notificationHref(notification));
  }

  const unreadItems = useMemo(() => data.items.filter((item) => !item.read_at), [data.items]);
  const readItems = useMemo(() => data.items.filter((item) => Boolean(item.read_at)), [data.items]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {data.unread_count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white leading-none">
            {data.unread_count > 99 ? "99+" : data.unread_count}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px]">
        <div className="flex items-center justify-between px-3 py-2.5">
          <p className="text-sm font-semibold text-slate-900">Notifications</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700"
            data-testid="btn-mark-all-read"
            onClick={() => void markAllRead()}
          >
            Mark all read
          </Button>
        </div>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="px-3 py-4 text-center text-sm text-slate-500">Loading...</div>
        ) : null}
        {error ? (
          <div className="px-3 py-2 text-sm text-red-600">{error}</div>
        ) : null}
        {!loading && !error && data.items.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-slate-500">No notifications yet.</div>
        ) : null}
        {!loading && !error && unreadItems.length > 0 ? (
          <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Unread
          </div>
        ) : null}
        {!loading && !error
          ? unreadItems.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className="flex w-full gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                onClick={() => void openNotification(notification)}
              >
                <span className="mt-1 flex h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{notificationTitle(notification)}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{notificationDescription(notification)}</p>
                  <p className="mt-1 text-[11px] text-slate-400" title={new Date(notification.created_at).toLocaleString()}>
                    {formatRelativeTime(notification.created_at, now)}
                  </p>
                </div>
              </button>
            ))
          : null}
        {!loading && !error && unreadItems.length > 0 && readItems.length > 0 ? (
          <DropdownMenuSeparator />
        ) : null}
        {!loading && !error && readItems.length > 0 ? (
          <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Earlier
          </div>
        ) : null}
        {!loading && !error
          ? readItems.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className="flex w-full gap-3 rounded-lg px-3 py-2.5 text-left opacity-70 transition-colors hover:bg-slate-50 hover:opacity-100"
                onClick={() => void openNotification(notification)}
              >
                <span className="mt-1 flex h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700">{notificationTitle(notification)}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{notificationDescription(notification)}</p>
                  <p className="mt-1 text-[11px] text-slate-400" title={new Date(notification.created_at).toLocaleString()}>
                    {formatRelativeTime(notification.created_at, now)}
                  </p>
                </div>
              </button>
            ))
          : null}
        <DropdownMenuSeparator />
        <div className="px-2 pb-1">
          <Link
            href="/notifications"
            className="block rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
          >
            View all notifications
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
