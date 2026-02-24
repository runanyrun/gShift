import {
  completeAssignmentInputSchema,
  inviteWorkerInputSchema,
  respondAssignmentInputSchema,
} from "./schemas";
import { getSupabaseBrowserClient } from "./supabase-browser";
import { mapPostgresError } from "./error-map";

export async function inviteWorker(jobId: string, workerId: string) {
  const input = inviteWorkerInputSchema.parse({ jobId, workerId });
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("rpc_invite_worker", {
    p_job_id: input.jobId,
    p_worker_id: input.workerId,
  });

  if (error) {
    const mapped = mapPostgresError(error);
    throw new Error(`${mapped.code}:${mapped.message}`);
  }
  return data;
}

export async function respondAssignment(assignmentId: string, accept: boolean) {
  const input = respondAssignmentInputSchema.parse({ assignmentId, accept });
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("rpc_respond_assignment", {
    p_assignment_id: input.assignmentId,
    p_accept: input.accept,
  });

  if (error) {
    const mapped = mapPostgresError(error);
    throw new Error(`${mapped.code}:${mapped.message}`);
  }
  return data;
}

export async function completeAssignment(
  assignmentId: string,
  minutesWorked: number,
  score?: number | null,
  note?: string | null,
) {
  const input = completeAssignmentInputSchema.parse({ assignmentId, minutesWorked, score, note });
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("rpc_complete_assignment", {
    p_assignment_id: input.assignmentId,
    p_minutes_worked: input.minutesWorked,
    p_score: input.score ?? null,
    p_note: input.note ?? null,
  });

  if (error) {
    const mapped = mapPostgresError(error);
    throw new Error(`${mapped.code}:${mapped.message}`);
  }
  return data;
}
