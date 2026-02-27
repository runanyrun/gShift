export type InviteStatus = "pending" | "active" | "completed" | "cancelled";
export type InviteDecision = "accept" | "reject";

export function canRespondInvite(status: InviteStatus, decision: InviteDecision): boolean {
  if (decision === "accept") {
    return status === "pending";
  }
  return status === "pending";
}

export function nextInviteStatus(status: InviteStatus, decision: InviteDecision): InviteStatus {
  if (!canRespondInvite(status, decision)) {
    return status;
  }
  return decision === "accept" ? "active" : "cancelled";
}
