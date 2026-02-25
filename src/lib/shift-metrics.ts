export type ShiftMetricsInput = {
  start_at: string;
  end_at: string;
  break_minutes?: number | null;
  hourly_wage: number;
  status?: "open" | "closed" | "cancelled" | null;
};

export type ShiftMetrics = {
  duration_hours: number;
  shift_cost: number;
  hourly_wage: number;
};

export function calcShiftMetrics(input: ShiftMetricsInput): ShiftMetrics {
  if (input.status === "cancelled") {
    return {
      duration_hours: 0,
      shift_cost: 0,
      hourly_wage: Number(input.hourly_wage) || 0,
    };
  }

  const startMs = new Date(input.start_at).getTime();
  const endMs = new Date(input.end_at).getTime();
  const safeBreakMinutes = Math.max(0, Number(input.break_minutes ?? 0));

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return {
      duration_hours: 0,
      shift_cost: 0,
      hourly_wage: Number(input.hourly_wage) || 0,
    };
  }

  const rawMinutes = (endMs - startMs) / 60000;
  const netMinutes = Math.max(0, rawMinutes - safeBreakMinutes);
  const durationHours = netMinutes / 60;
  const hourlyWage = Number(input.hourly_wage) || 0;

  return {
    duration_hours: durationHours,
    shift_cost: durationHours * hourlyWage,
    hourly_wage: hourlyWage,
  };
}
