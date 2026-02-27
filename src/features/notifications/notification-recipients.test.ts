import { describe, expect, it } from "vitest";
import {
  buildNotificationDedupeKey,
  canOnlyUpdateReadAt,
  markReadState,
  selectJobCancelledRecipients,
  selectNotificationRecipients,
  shouldSkipNotificationAsDuplicate,
} from "./notification-recipients";

describe("notification recipient selection", () => {
  it("prioritizes createdBy and appends unique manager ids", () => {
    const recipients = selectNotificationRecipients(["u1", "u2", "u1"], "creator-1");
    expect(recipients).toEqual(["creator-1", "u1", "u2"]);
  });

  it("falls back to createdBy when managers are unavailable", () => {
    const recipients = selectNotificationRecipients([], "creator-1");
    expect(recipients).toEqual(["creator-1"]);
  });

  it("returns empty list when no manager and no creator", () => {
    const recipients = selectNotificationRecipients([], null);
    expect(recipients).toEqual([]);
  });
});

describe("cancel recipient selection", () => {
  it("includes only applied/invited/accepted users with unique ids", () => {
    const recipients = selectJobCancelledRecipients([
      { worker_user_id: "u1", status: "applied" },
      { worker_user_id: "u2", status: "invited" },
      { worker_user_id: "u3", status: "accepted" },
      { worker_user_id: "u4", status: "rejected" },
      { worker_user_id: "u5", status: "withdrawn" },
      { worker_user_id: "u3", status: "accepted" },
    ]);
    expect(recipients).toEqual(["u1", "u2", "u3"]);
  });
});

describe("notification dedupe key", () => {
  it("creates stable key from type + entity ids", () => {
    expect(
      buildNotificationDedupeKey("job_applied", {
        job_post_id: "j1",
        application_id: "a1",
      }),
    ).toBe("job_applied|j1|");
  });

  it("disables dedupe when no entity ids exist", () => {
    expect(buildNotificationDedupeKey("job_applied", { reason: "noop" })).toBeNull();
  });

  it("dedupes same user+type+job_post_id within 30s", () => {
    const shouldSkip = shouldSkipNotificationAsDuplicate(
      [
        {
          user_id: "u1",
          type: "job_applied",
          payload: { job_post_id: "job-1", application_id: "app-1" },
          created_at: "2026-02-27T10:00:00.000Z",
        },
      ],
      {
        user_id: "u1",
        type: "job_applied",
        payload: { job_post_id: "job-1", application_id: "app-1" },
        created_at: "2026-02-27T10:00:20.000Z",
      },
      30,
    );
    expect(shouldSkip).toBe(true);
  });
});

describe("mark read state", () => {
  it("marks unread notification and keeps other rows unchanged", () => {
    const nowIso = "2026-02-27T10:00:00.000Z";
    const next = markReadState(
      [
        { id: "n1", read_at: null },
        { id: "n2", read_at: "2026-02-26T10:00:00.000Z" },
      ],
      "n1",
      nowIso,
    );
    expect(next[0].read_at).toBe(nowIso);
    expect(next[1].read_at).toBe("2026-02-26T10:00:00.000Z");
  });
});

describe("read_at guard", () => {
  it("accepts read_at-only transition", () => {
    expect(
      canOnlyUpdateReadAt(
        {
          company_id: "c1",
          user_id: "u1",
          type: "invited",
          payload: { job_post_id: "j1" },
          created_at: "2026-02-27T10:00:00.000Z",
          read_at: null,
        },
        {
          company_id: "c1",
          user_id: "u1",
          type: "invited",
          payload: { job_post_id: "j1" },
          created_at: "2026-02-27T10:00:00.000Z",
          read_at: "2026-02-27T10:10:00.000Z",
        },
      ),
    ).toBe(true);
  });

  it("rejects updates touching payload", () => {
    expect(
      canOnlyUpdateReadAt(
        {
          company_id: "c1",
          user_id: "u1",
          type: "invited",
          payload: { job_post_id: "j1" },
          created_at: "2026-02-27T10:00:00.000Z",
          read_at: null,
        },
        {
          company_id: "c1",
          user_id: "u1",
          type: "invited",
          payload: { job_post_id: "j2" },
          created_at: "2026-02-27T10:00:00.000Z",
          read_at: "2026-02-27T10:10:00.000Z",
        },
      ),
    ).toBe(false);
  });
});
