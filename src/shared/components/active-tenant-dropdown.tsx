"use client";

import { useEffect, useState } from "react";
import {
  getActiveTenantId,
  loadTenantMemberships,
  setActiveTenantId,
  TenantMembership,
} from "../../lib/tenancy";

export function ActiveTenantDropdown() {
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    loadTenantMemberships()
      .then((rows) => {
        if (!mounted) return;
        setMemberships(rows);
        const stored = getActiveTenantId();
        const fallback = stored && rows.some((row) => row.tenantId === stored) ? stored : rows[0]?.tenantId ?? "";
        if (fallback) {
          setActive(fallback);
          setActiveTenantId(fallback);
        }
      })
      .catch(() => {
        if (mounted) {
          setMemberships([]);
          setActive("");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (memberships.length === 0) {
    return null;
  }

  return (
    <label>
      Workspace:{" "}
      <select
        value={active}
        onChange={(event) => {
          const next = event.target.value;
          setActive(next);
          setActiveTenantId(next);
        }}
      >
        {memberships.map((membership) => (
          <option key={membership.tenantId} value={membership.tenantId}>
            {membership.tenantName}
          </option>
        ))}
      </select>
    </label>
  );
}
