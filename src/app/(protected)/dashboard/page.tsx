"use client";

import { useEffect, useState } from "react";
import { DashboardBootstrapPayload } from "../../../features/dashboard/types/dashboard.types";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardBootstrapPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    fetch("/api/dashboard/bootstrap", { method: "GET" })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? "Failed to load dashboard bootstrap.");
        }

        return (await response.json()) as DashboardBootstrapPayload;
      })
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setData(payload);
      })
      .catch((fetchError) => {
        if (!mounted) {
          return;
        }
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Unexpected dashboard bootstrap error.";
        setError(message);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return <div>{error}</div>;
  }

  if (!data) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div>
      <h1>{data.company.name}</h1>
      <p>
        Role: {data.user.role} | Users: {data.metrics.usersCount}
      </p>
      <p>
        Timezone: {data.company.timezone ?? "not-set"} | Currency:{" "}
        {data.company.currencyCode ?? "not-set"}
      </p>
    </div>
  );
}
