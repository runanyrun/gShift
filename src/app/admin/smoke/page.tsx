"use client";

import { useEffect, useState } from "react";
import { completeAssignment, inviteWorker, respondAssignment } from "../../../lib/rpc";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";
import { getActiveTenantId } from "../../../lib/tenancy";

type CheckStatus = "idle" | "running" | "pass" | "fail";

interface CheckResult {
  status: CheckStatus;
  message?: string;
  data?: unknown;
}

function initialCheckResult(): CheckResult {
  return { status: "idle" };
}

export default function AdminSmokePage() {
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [results, setResults] = useState<Record<string, CheckResult>>({
    check1: initialCheckResult(),
    check2: initialCheckResult(),
    check3: initialCheckResult(),
    check4: initialCheckResult(),
    check5: initialCheckResult(),
    check6: initialCheckResult(),
  });
  const [userInfo, setUserInfo] = useState<{ id: string; email: string | null } | null>(null);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(getActiveTenantId());

  useEffect(() => {
    const syncActiveTenant = () => setActiveTenantId(getActiveTenantId());
    window.addEventListener("active-tenant-changed", syncActiveTenant);
    return () => {
      window.removeEventListener("active-tenant-changed", syncActiveTenant);
    };
  }, []);

  async function runCheck(key: keyof typeof results, fn: () => Promise<unknown>) {
    setResults((current) => ({ ...current, [key]: { status: "running" } }));
    try {
      const data = await fn();
      setResults((current) => ({
        ...current,
        [key]: { status: "pass", data, message: "PASS" },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setResults((current) => ({
        ...current,
        [key]: { status: "fail", message, data: null },
      }));
    }
  }

  async function getCurrentUser() {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error(error?.message ?? "Please sign in.");
    }
    const info = { id: user.id, email: user.email ?? null };
    setUserInfo(info);
    return info;
  }

  return (
    <main>
      <h1>Admin Smoke Panel</h1>
      <p>Auth User: {userInfo ? `${userInfo.id} (${userInfo.email ?? "no-email"})` : "unknown"}</p>
      <p>Active Tenant: {activeTenantId ?? "not selected"}</p>

      <section>
        <h2>Inputs</h2>
        <label>
          Job ID:{" "}
          <input value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)} />
        </label>
        <br />
        <label>
          Worker ID:{" "}
          <input value={selectedWorkerId} onChange={(event) => setSelectedWorkerId(event.target.value)} />
        </label>
      </section>

      <section>
        <h2>Checks</h2>
        <button
          type="button"
          onClick={() =>
            void runCheck("check1", async () => {
              const supabase = getSupabaseBrowserClient();
              const { data, error } = await supabase
                .from("jobs")
                .select("id,title,work_date,start_time,end_time,status,is_public")
                .eq("is_public", true)
                .eq("status", "open")
                .order("work_date", { ascending: true })
                .order("start_time", { ascending: true });
              if (error) {
                throw new Error(error.message);
              }
              const first = (data ?? [])[0] as { id?: string } | undefined;
              if (first?.id && !selectedJobId) {
                setSelectedJobId(first.id);
              }
              return data ?? [];
            })
          }
        >
          Check 1: List public jobs
        </button>
        <pre>{JSON.stringify(results.check1, null, 2)}</pre>

        <button
          type="button"
          onClick={() =>
            void runCheck("check2", async () => {
              const supabase = getSupabaseBrowserClient();
              const user = await getCurrentUser();
              const jobId = selectedJobId.trim();
              if (!jobId) {
                throw new Error("Provide job id first.");
              }
              const { data, error } = await supabase
                .from("job_applications")
                .insert({ job_id: jobId, worker_id: user.id })
                .select("id,job_id,worker_id,status,created_at")
                .maybeSingle();
              if (error) {
                if (error.code === "23505") {
                  return { alreadyApplied: true, jobId, workerId: user.id };
                }
                throw new Error(error.message);
              }
              return data;
            })
          }
        >
          Check 2: Apply to selected job
        </button>
        <pre>{JSON.stringify(results.check2, null, 2)}</pre>

        <button
          type="button"
          onClick={() =>
            void runCheck("check3", async () => {
              const tenantId = getActiveTenantId();
              if (!tenantId) {
                throw new Error("No active tenant selected.");
              }
              const supabase = getSupabaseBrowserClient();
              const { data, error } = await supabase
                .from("jobs")
                .select("id,title,status,work_date,start_time,end_time")
                .eq("tenant_id", tenantId)
                .order("created_at", { ascending: false });
              if (error) {
                throw new Error(error.message);
              }
              const first = (data ?? [])[0] as { id?: string } | undefined;
              if (first?.id && !selectedJobId) {
                setSelectedJobId(first.id);
              }
              return data ?? [];
            })
          }
        >
          Check 3: Load tenant jobs
        </button>
        <pre>{JSON.stringify(results.check3, null, 2)}</pre>

        <button
          type="button"
          onClick={() =>
            void runCheck("check4", async () => {
              const jobId = selectedJobId.trim();
              if (!jobId) {
                throw new Error("Provide job id first.");
              }
              const supabase = getSupabaseBrowserClient();
              const { data, error } = await supabase
                .from("job_applications")
                .select("id,job_id,worker_id,status,created_at")
                .eq("job_id", jobId)
                .order("created_at", { ascending: false });
              if (error) {
                throw new Error(error.message);
              }
              const first = (data ?? [])[0] as { worker_id?: string } | undefined;
              if (first?.worker_id && !selectedWorkerId) {
                setSelectedWorkerId(first.worker_id);
              }
              return data ?? [];
            })
          }
        >
          Check 4: Load applications for selected job
        </button>
        <pre>{JSON.stringify(results.check4, null, 2)}</pre>

        <button
          type="button"
          onClick={() =>
            void runCheck("check5", async () => {
              const jobId = selectedJobId.trim();
              const workerId = selectedWorkerId.trim();
              if (!jobId || !workerId) {
                throw new Error("Provide both job id and worker id.");
              }
              return inviteWorker(jobId, workerId);
            })
          }
        >
          Check 5: Invite worker (RPC)
        </button>
        <pre>{JSON.stringify(results.check5, null, 2)}</pre>

        <button
          type="button"
          onClick={() =>
            void runCheck("check6", async () => {
              const supabase = getSupabaseBrowserClient();
              const tenantId = getActiveTenantId();
              if (!tenantId) {
                throw new Error("No active tenant selected.");
              }
              const user = await getCurrentUser();

              const { data: pendingRows, error: pendingError } = await supabase
                .from("job_assignments")
                .select("id,status,worker_id,invited_at")
                .eq("worker_id", user.id)
                .eq("status", "pending")
                .order("invited_at", { ascending: false })
                .limit(1);
              if (pendingError) {
                throw new Error(`Pending load failed: ${pendingError.message}`);
              }

              let acceptedAssignmentId: string | null = null;
              if ((pendingRows ?? []).length > 0) {
                const assignment = pendingRows![0] as { id: string };
                await respondAssignment(assignment.id, true);
                acceptedAssignmentId = assignment.id;
              }

              const { data: acceptedRows, error: acceptedError } = await supabase
                .from("job_assignments")
                .select("id,worker_id,status,jobs!inner(tenant_id,title)")
                .eq("jobs.tenant_id", tenantId)
                .eq("status", "accepted")
                .order("accepted_at", { ascending: false })
                .limit(20);
              if (acceptedError) {
                throw new Error(`Accepted load failed: ${acceptedError.message}`);
              }

              const acceptedForCurrentUser = (acceptedRows ?? []).find(
                (row: any) => row.worker_id === user.id,
              ) as { id: string } | undefined;

              if (acceptedForCurrentUser) {
                try {
                  await completeAssignment(acceptedForCurrentUser.id, 30, null, "smoke");
                } catch (completeError) {
                  const message =
                    completeError instanceof Error ? completeError.message.toLowerCase() : "";
                  if (message.includes("forbidden")) {
                    return {
                      pendingChecked: pendingRows ?? [],
                      acceptedChecked: acceptedRows ?? [],
                      completedAssignmentId: null,
                      note: "Manager account required to complete accepted assignments.",
                    };
                  }
                  throw completeError;
                }
                acceptedAssignmentId = acceptedForCurrentUser.id;
              }

              return {
                pendingChecked: pendingRows ?? [],
                acceptedChecked: acceptedRows ?? [],
                completedAssignmentId: acceptedAssignmentId,
              };
            })
          }
        >
          Check 6: Worker respond + manager complete (RPC)
        </button>
        <pre>{JSON.stringify(results.check6, null, 2)}</pre>
      </section>
    </main>
  );
}
