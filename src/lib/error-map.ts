interface PostgresLikeError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

const FRIENDLY_MESSAGES: Record<string, string> = {
  forbidden: "You do not have permission for this action.",
  job_not_open: "This job is no longer open.",
  assignment_already_exists: "An assignment already exists for this job.",
  not_pending: "This assignment is not pending.",
  not_accepted: "This assignment is not accepted.",
  invalid_minutes: "Minutes worked is invalid.",
  invalid_score: "Score must be between 1 and 5.",
};

export function mapPostgresError(error: unknown): { code: string; message: string } {
  const err = (error ?? {}) as PostgresLikeError;
  const raw = `${err.message ?? ""} ${err.details ?? ""} ${err.hint ?? ""}`.toLowerCase();

  let code = "unknown";
  if (raw.includes("forbidden") || raw.includes("permission denied") || err.code === "42501") {
    code = "forbidden";
  } else if (raw.includes("job_not_open") || raw.includes("not open")) {
    code = "job_not_open";
  } else if (raw.includes("assignment_already_exists") || err.code === "23505") {
    code = "assignment_already_exists";
  } else if (raw.includes("not_pending")) {
    code = "not_pending";
  } else if (raw.includes("not_accepted")) {
    code = "not_accepted";
  } else if (raw.includes("invalid_minutes")) {
    code = "invalid_minutes";
  } else if (raw.includes("invalid_score")) {
    code = "invalid_score";
  }

  return {
    code,
    message: FRIENDLY_MESSAGES[code] ?? (err.message || "Unexpected error."),
  };
}
