type DemoInput = {
  companyId: string;
  days: string[];
  startTime?: string;
  endTime?: string;
};

type CompanyPrefs = {
  timezone: string;
  defaultShiftStart: string;
  defaultShiftEnd: string;
};

type ShiftRow = {
  company_id: string;
  start_at: string;
  end_at: string;
};

type Deps = {
  companyPrefs: (companyId: string) => Promise<CompanyPrefs>;
  shiftsRepo: {
    insertMany: (rows: ShiftRow[]) => Promise<ShiftRow[]>;
  };
};

function isValidTime(value: string | undefined) {
  return !!value && /^\d{2}:\d{2}$/.test(value);
}

export async function createDemoSchedule(input: DemoInput, deps: Deps): Promise<{ shifts: ShiftRow[] }> {
  const prefs = await deps.companyPrefs(input.companyId);
  const start = isValidTime(input.startTime) ? (input.startTime as string) : prefs.defaultShiftStart || "09:00";
  const end = isValidTime(input.endTime) ? (input.endTime as string) : prefs.defaultShiftEnd || "17:00";

  const rows: ShiftRow[] = input.days.map((day) => ({
    company_id: input.companyId,
    start_at: `${day}T${start}:00`,
    end_at: `${day}T${end}:00`,
  }));

  const shifts = await deps.shiftsRepo.insertMany(rows);
  return { shifts };
}
