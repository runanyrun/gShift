export type NotificationRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

function getString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return null;
}

export function notificationHref(notification: NotificationRow): string {
  const jobId = getString(notification.payload, "job_post_id") ?? getString(notification.payload, "job_id");
  if (notification.type === "job_applied" && jobId) {
    return `/manager/jobs/${jobId}`;
  }
  if (notification.type === "invite_accepted" && jobId) {
    return `/manager/jobs/${jobId}`;
  }
  if (notification.type === "invite_rejected" && jobId) {
    return `/manager/jobs/${jobId}`;
  }
  if (notification.type === "job_cancelled" && jobId) {
    return `/jobs/${jobId}`;
  }
  if (notification.type === "job_closed" && jobId) {
    return `/manager/jobs/${jobId}`;
  }
  if (notification.type === "invited") {
    return "/worker/applications";
  }
  if (notification.type === "applicant_rejected") {
    return "/worker/applications";
  }
  return "/notifications";
}

export function notificationTitle(notification: NotificationRow): string {
  if (notification.type === "job_applied") return "New application received";
  if (notification.type === "invited") return "You received an invite";
  if (notification.type === "invite_accepted") return "Invite accepted";
  if (notification.type === "invite_rejected") return "Invite rejected";
  if (notification.type === "applicant_rejected") return "Application update";
  if (notification.type === "job_cancelled") return "Job cancelled";
  if (notification.type === "job_closed") return "Job closed";
  return "Notification";
}

export function notificationDescription(notification: NotificationRow): string {
  if (notification.type === "job_applied") return "A worker applied to your job posting.";
  if (notification.type === "invited") return "A manager invited you to a job.";
  if (notification.type === "invite_accepted") return "Worker accepted the invite.";
  if (notification.type === "invite_rejected") return "Worker rejected the invite.";
  if (notification.type === "applicant_rejected") return "Your application was rejected.";
  if (notification.type === "job_cancelled") return "A related job posting was cancelled.";
  if (notification.type === "job_closed") return "A job posting is now closed.";
  return "New activity is available.";
}
