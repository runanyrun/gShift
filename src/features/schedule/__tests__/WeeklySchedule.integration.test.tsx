import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WeeklySchedule } from "../../../components/schedule/WeeklySchedule";

type MockResponseBody = { ok: boolean; data?: unknown; error?: string };

function json(body: MockResponseBody) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => body,
  }) as Promise<Response>;
}

function createFetchMock(weekStartsOn: "mon" | "sun") {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);

    if (url.startsWith("/api/locations")) {
      return json({
        ok: true,
        data: [{ id: "loc-1", name: "Main", timezone: "Europe/Istanbul" }],
      });
    }
    if (url.startsWith("/api/roles")) {
      return json({
        ok: true,
        data: [{ id: "role-1", name: "Cashier", hourly_wage_default: 100 }],
      });
    }
    if (url.startsWith("/api/company/settings")) {
      return json({
        ok: true,
        data: {
          week_starts_on: weekStartsOn,
          default_shift_start: "09:00",
          default_shift_end: "17:00",
          locale: "tr-TR",
          currency: "TRY",
          timezone: "Europe/Istanbul",
        },
      });
    }
    if (url.startsWith("/api/employees")) {
      return json({
        ok: true,
        data: [
          {
            id: "emp-1",
            full_name: "Jane Doe",
            location_id: "loc-1",
            role_id: "role-1",
            hourly_rate: 120,
            active: true,
          },
        ],
      });
    }
    if (url.startsWith("/api/schedule")) {
      return json({ ok: true, data: [] });
    }

    return json({ ok: true, data: [] });
  });
}

describe("WeeklySchedule integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-25T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("aligns week to Sunday when company week_starts_on is sun", async () => {
    vi.stubGlobal("fetch", createFetchMock("sun"));

    render(<WeeklySchedule />);

    await waitFor(() => {
      expect(screen.getByTestId("week-range-label").textContent).toMatch(/22\.02\.2026\s*-\s*28\.02\.2026/);
    });

    expect(screen.getByTestId("week-day-2026-02-22").textContent).toMatch(/^Sun\s+22\.02\.2026$/);
  });

  it("aligns week to Monday when company week_starts_on is mon", async () => {
    vi.stubGlobal("fetch", createFetchMock("mon"));

    render(<WeeklySchedule />);

    await waitFor(() => {
      expect(screen.getByTestId("week-range-label").textContent).toMatch(/23\.02\.2026\s*-\s*01\.03\.2026/);
    });

    expect(screen.getByTestId("week-day-2026-02-23").textContent).toMatch(/^Mon\s+23\.02\.2026$/);
  });
});
