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
      <DropdownMenuTrigger className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50">
        Notifications
        {data.unread_count > 0 ? (
          <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {data.unread_count > 99 ? "99+" : data.unread_count}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px]">
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activity</p>
          <Button type="button" variant="outline" className="h-7 px-2 text-xs" onClick={() => void markAllRead()}>
            Mark all read
          </Button>
        </div>
        <DropdownMenuSeparator />
        {loading ? <div className="px-2 py-2 text-sm text-slate-600">Loading...</div> : null}
        {error ? <div className="px-2 py-2 text-sm text-red-700">{error}</div> : null}
        {!loading && !error && data.items.length === 0 ? (
          <div className="px-2 py-3 text-sm text-slate-600">No notifications yet.</div>
        ) : null}
        {!loading && !error && unreadItems.length > 0 ? (
          <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unread</div>
        ) : null}
        {!loading && !error
          ? unreadItems.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className="block w-full border-b border-slate-100 px-2 py-2 text-left transition-colors hover:bg-slate-50"
                onClick={() => void openNotification(notification)}
              >
                <p className="text-sm font-medium text-slate-900">{notificationTitle(notification)}</p>
                <p className="text-xs text-slate-600">{notificationDescription(notification)}</p>
                <p className="mt-1 text-[11px] text-slate-500" title={new Date(notification.created_at).toLocaleString()}>
                  {formatRelativeTime(notification.created_at, now)}
                </p>
              </button>
            ))
          : null}
        {!loading && !error && unreadItems.length > 0 && readItems.length > 0 ? <DropdownMenuSeparator /> : null}
        {!loading && !error && readItems.length > 0 ? (
          <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Read</div>
        ) : null}
        {!loading && !error
          ? readItems.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className="block w-full border-b border-slate-100 px-2 py-2 text-left transition-colors hover:bg-slate-50"
                onClick={() => void openNotification(notification)}
              >
                <p className="text-sm font-medium text-slate-800">{notificationTitle(notification)}</p>
                <p className="text-xs text-slate-500">{notificationDescription(notification)}</p>
                <p className="mt-1 text-[11px] text-slate-500" title={new Date(notification.created_at).toLocaleString()}>
                  {formatRelativeTime(notification.created_at, now)}
                </p>
              </button>
            ))
          : null}
        <DropdownMenuSeparator />
        <div className="px-1">
          <Link href="/notifications" className="block rounded-sm px-2 py-1.5 text-sm hover:bg-slate-100">
            Open notifications page
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
