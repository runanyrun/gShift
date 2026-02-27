import { describe, expect, it } from "vitest";
import { canRespondInvite, nextInviteStatus } from "./invite-lifecycle";

describe("invite lifecycle", () => {
  it("allows accepting pending invites", () => {
    expect(canRespondInvite("pending", "accept")).toBe(true);
    expect(nextInviteStatus("pending", "accept")).toBe("active");
  });

  it("allows rejecting pending invites", () => {
    expect(canRespondInvite("pending", "reject")).toBe(true);
    expect(nextInviteStatus("pending", "reject")).toBe("cancelled");
  });

  it("does not transition non-pending invites", () => {
    expect(canRespondInvite("active", "reject")).toBe(false);
    expect(nextInviteStatus("active", "reject")).toBe("active");
    expect(canRespondInvite("completed", "accept")).toBe(false);
    expect(nextInviteStatus("completed", "accept")).toBe("completed");
  });
});
