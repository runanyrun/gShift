export function selectNotificationRecipients(managerUserIds: string[], createdBy: string | null): string[] {
  const created = createdBy && createdBy.trim().length > 0 ? createdBy.trim() : null;
  const uniqueManagers = Array.from(new Set(managerUserIds.map((value) => value.trim()).filter((value) => value.length > 0)));
  if (created) {
    return Array.from(new Set([created, ...uniqueManagers]));
  }
  if (uniqueManagers.length > 0) {
    return uniqueManagers;
  }
  return [];
}

export function selectJobCancelledRecipients(
  applications: Array<{ worker_user_id: string | null; status: string }>,
): string[] {
  return Array.from(
    new Set(
      applications
        .filter((item) => ["applied", "invited", "accepted"].includes(item.status))
        .map((item) => item.worker_user_id?.trim() ?? "")
        .filter((value) => value.length > 0),
    ),
  );
}

type NotificationPayload = Record<string, unknown>;

function getString(payload: NotificationPayload, key: string): string | null {
  const value = payload[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildNotificationDedupeKey(type: string, payload: NotificationPayload): string | null {
  const jobPostId = getString(payload, "job_post_id") ?? getString(payload, "job_id");
  const assignmentId = getString(payload, "assignment_id");
  const applicationId = getString(payload, "application_id");
  if (!jobPostId && !assignmentId && !applicationId) {
    return null;
  }
  return `${type}|${jobPostId ?? ""}|${assignmentId ?? ""}|${applicationId ?? ""}`;
}

export function shouldSkipNotificationAsDuplicate(
  items: Array<{ user_id: string; type: string; payload: NotificationPayload; created_at: string }>,
  candidate: { user_id: string; type: string; payload: NotificationPayload; created_at: string },
  dedupeWindowSeconds = 30,
): boolean {
  const candidateKey = buildNotificationDedupeKey(candidate.type, candidate.payload);
  if (!candidateKey) {
    return false;
  }

  const candidateAt = new Date(candidate.created_at).getTime();
  if (Number.isNaN(candidateAt)) {
    return false;
  }

  return items.some((item) => {
    if (item.user_id !== candidate.user_id || item.type !== candidate.type) {
      return false;
    }
    const itemKey = buildNotificationDedupeKey(item.type, item.payload);
    if (!itemKey || itemKey !== candidateKey) {
      return false;
    }
    const itemAt = new Date(item.created_at).getTime();
    if (Number.isNaN(itemAt)) {
      return false;
    }
    return candidateAt - itemAt <= dedupeWindowSeconds * 1000;
  });
}

export function canOnlyUpdateReadAt(
  previous: {
    company_id: string;
    user_id: string;
    type: string;
    payload: NotificationPayload;
    created_at: string;
    read_at: string | null;
  },
  next: {
    company_id: string;
    user_id: string;
    type: string;
    payload: NotificationPayload;
    created_at: string;
    read_at: string | null;
  },
): boolean {
  if (
    previous.company_id !== next.company_id
    || previous.user_id !== next.user_id
    || previous.type !== next.type
    || previous.created_at !== next.created_at
    || JSON.stringify(previous.payload) !== JSON.stringify(next.payload)
  ) {
    return false;
  }

  if (previous.read_at && previous.read_at !== next.read_at) {
    return false;
  }

  if (!previous.read_at && !next.read_at) {
    return false;
  }

  return true;
}

export function markReadState(
  notifications: Array<{ id: string; read_at: string | null }>,
  targetId: string,
  nowIso: string,
): Array<{ id: string; read_at: string | null }> {
  return notifications.map((item) => {
    if (item.id !== targetId) {
      return item;
    }
    if (item.read_at) {
      return item;
    }
    return {
      ...item,
      read_at: nowIso,
    };
  });
}
