import { describe, expect, it, vi } from "vitest";
import { createDemoSchedule } from "../createDemoSchedule";

describe("createDemoSchedule integration", () => {
  it("uses company default shift times when request times are omitted", async () => {
    const insertMany = vi.fn(async (rows: Array<{ company_id: string; start_at: string; end_at: string }>) => rows);

    const result = await createDemoSchedule(
      {
        companyId: "company-1",
        days: ["2026-02-25"],
      },
      {
        companyPrefs: async () => ({
          timezone: "Europe/Istanbul",
          defaultShiftStart: "09:00",
          defaultShiftEnd: "17:00",
        }),
        shiftsRepo: {
          insertMany,
        },
      },
    );

    expect(insertMany).toHaveBeenCalledTimes(1);
    expect(result.shifts).toHaveLength(1);
    expect(result.shifts[0]?.start_at).toContain("T09:00");
    expect(result.shifts[0]?.end_at).toContain("T17:00");
  });
});
