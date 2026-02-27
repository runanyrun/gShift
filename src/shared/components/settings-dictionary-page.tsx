"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "../../core/db/supabase";
import { canManage as canManagePermissions } from "../../core/auth/permissions";
import { useMe } from "../../core/auth/useMe";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { PageHeader } from "../../components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { EmptyState } from "../../components/ui/empty-state";
import { Section } from "../../components/ui/section";
import { DataTableToolbar } from "../../components/ui/data-table-toolbar";
import { Skeleton } from "../../components/ui/skeleton";

interface DictionaryItem {
  id: string;
  name: string;
  isActive: boolean;
}

interface SettingsDictionaryPageProps {
  title: string;
  endpoint: string;
}

export function SettingsDictionaryPage({ title, endpoint }: SettingsDictionaryPageProps) {
  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmItem, setConfirmItem] = useState<DictionaryItem | null>(null);
  const { data: me } = useMe();
  const canManage = canManagePermissions(me?.permissions);
  const singularTitle = title.endsWith("s") ? title.slice(0, -1) : title;
  const titleSlug = title.toLowerCase().replace(/\s+/g, "-");

  async function authorizedFetch(path: string, init?: RequestInit) {
    const supabase = createBrowserSupabaseClient();
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session?.access_token) {
      throw new Error("Auth session missing.");
    }
    return fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
        ...(init?.headers ?? {}),
      },
    });
  }

  async function load() {
    setLoading(true);
    try {
      const response = await authorizedFetch(endpoint, { method: "GET" });
      const body = (await response.json()) as {
        ok: boolean;
        data?: Array<{ id: string; name: string; isActive: boolean }>;
        error?: string;
      };
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? `Failed to load ${title}.`);
      }
      setItems(body.data ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : `Failed to load ${title}.`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  async function onCreate() {
    setError(null);
    if (!canManage) {
      setError("You do not have permission to perform this action.");
      return;
    }
    if (!name.trim()) {
      setError(`${singularTitle} name is required.`);
      return;
    }
    setSaving(true);
    try {
      const response = await authorizedFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), isActive: true }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) {
        throw new Error(
          response.status === 401 || response.status === 403
            ? "You do not have permission to perform this action."
            : (body.error ?? `Failed to create ${title} item.`),
        );
      }
      setName("");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Create request failed.");
    } finally {
      setSaving(false);
    }
  }

  async function onToggle(item: DictionaryItem) {
    setError(null);
    if (!canManage) {
      setError("You do not have permission to perform this action.");
      return;
    }
    setSaving(true);
    try {
      const response = await authorizedFetch(`${endpoint}/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) {
        throw new Error(
          response.status === 401 || response.status === 403
            ? "You do not have permission to perform this action."
            : (body.error ?? `Failed to update ${title} item.`),
        );
      }
      await load();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Update request failed.");
    } finally {
      setSaving(false);
    }
  }

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return items;
    }
    return items.filter((item) => item.name.toLowerCase().includes(query));
  }, [items, search]);

  return (
    <section className="space-y-6">
      <PageHeader
        title={title}
        description={`Manage ${title.toLowerCase()} used in staffing, onboarding, and schedule assignment.`}
      />

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Section title={`${title} directory`} description="Primary task: maintain active options and create new values inline.">
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Directory</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTableToolbar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder={`Search ${title.toLowerCase()}`}
              actions={canManage ? (
                <>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`${titleSlug}-name`} className="sr-only">
                      {singularTitle} name
                    </Label>
                    <Input
                      id={`${titleSlug}-name`}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={`New ${singularTitle.toLowerCase()} name`}
                      className="w-full md:w-56"
                    />
                  </div>
                  <Button type="button" disabled={saving} onClick={() => void onCreate()}>
                    {saving ? "Saving..." : `Add ${singularTitle}`}
                  </Button>
                </>
              ) : null}
            />
            {loading ? (
              <div className="space-y-2 px-4 py-4">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title={`No ${title.toLowerCase()} yet`}
                  description={`Add your first ${singularTitle.toLowerCase()} to make it available in forms and schedule flows.`}
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage ? <TableHead className="text-right">Action</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>
                        <Badge variant={item.isActive ? "secondary" : "outline"}>
                          {item.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      {canManage ? (
                        <TableCell className="text-right">
                          <Button type="button" variant="outline" disabled={saving} onClick={() => setConfirmItem(item)}>
                            {item.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Section>

      <Dialog open={Boolean(confirmItem)} onOpenChange={(open) => (!open ? setConfirmItem(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmItem?.isActive ? "Deactivate item?" : "Activate item?"}</DialogTitle>
            <DialogDescription>
              {confirmItem?.isActive
                ? `This hides "${confirmItem.name}" from active selection lists.`
                : `This makes "${confirmItem?.name}" available in active selection lists.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setConfirmItem(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={confirmItem?.isActive ? "destructive" : "default"}
              disabled={saving || !confirmItem}
              onClick={() => {
                if (!confirmItem) {
                  return;
                }
                void onToggle(confirmItem).finally(() => setConfirmItem(null));
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
