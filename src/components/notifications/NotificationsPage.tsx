"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { EmptyState } from "../ui/empty-state";
import { PageHeader } from "../layout/PageHeader";
import { Skeleton } from "../ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { notificationDescription, notificationHref, NotificationRow, notificationTitle } from "../../features/notifications/notification-links";
import { Button } from "../ui/button";
import { formatRelativeTime } from "../../features/notifications/relative-time";

type NotificationsResponse = {
  items: NotificationRow[];
  unread_count: number;
};

export function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<NotificationsResponse>({ items: [], unread_count: 0 });
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
      const rows = await fetchJson<NotificationsResponse>("/api/notifications?limit=100");
      setPayload(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  async function markRead(id: string) {
    await fetchJson(`/api/notifications/${id}/read`, { method: "POST" });
    await load();
  }

  async function markAllRead() {
    await fetchJson("/api/notifications/read-all", { method: "POST" });
    await load();
  }

  const unreadItems = useMemo(() => payload.items.filter((item) => !item.read_at), [payload.items]);

  function renderList(items: NotificationRow[]) {
    if (loading) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <EmptyState
          title="No notifications"
          description="When job and invite activity happens, notifications will appear here."
        />
      );
    }
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-md border border-slate-200 p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">{notificationTitle(item)}</p>
              <p className="text-xs text-slate-500" title={new Date(item.created_at).toLocaleString()}>
                {formatRelativeTime(item.created_at, now)}
              </p>
            </div>
            <p className="text-sm text-slate-600">{notificationDescription(item)}</p>
            <div className="mt-2 flex items-center gap-2">
              <Link
                href={notificationHref(item)}
                onClick={() => {
                  if (!item.read_at) {
                    void markRead(item.id);
                  }
                }}
                className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-50"
              >
                Open
              </Link>
              {!item.read_at ? (
                <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => void markRead(item.id)}>
                  Mark as read
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Track application, invite, and lifecycle activity in one place."
        actions={(
          <Button type="button" variant="outline" data-testid="btn-mark-all-read" onClick={() => void markAllRead()}>
            Mark all as read
          </Button>
        )}
      />

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inbox ({payload.unread_count} unread)</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
            </TabsList>
            <TabsContent value="all">{renderList(payload.items)}</TabsContent>
            <TabsContent value="unread">{renderList(unreadItems)}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </section>
  );
}
