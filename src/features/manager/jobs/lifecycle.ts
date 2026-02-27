export type ManagerJobStatus = "draft" | "open" | "closed" | "cancelled" | "assigned";
export type ManagerJobAction = "close" | "cancel" | "reopen";

export function canTransitionJobStatus(current: ManagerJobStatus, action: ManagerJobAction): boolean {
  if (current === "cancelled") {
    return false;
  }

  if (action === "cancel") {
    return current === "open" || current === "closed" || current === "assigned";
  }

  if (action === "close") {
    return current === "open";
  }

  if (action === "reopen") {
    return current === "closed";
  }

  return false;
}
