import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../../lib/auth";
import { handleRouteError, HttpError, jsonOk, parseJson } from "../../../../lib/http";

const shiftSchema = z.object({
  id: z.string().uuid().optional(),
  location_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  role_id: z.string().uuid(),
  start_at: z.string().datetime({ offset: true }),
  end_at: z.string().datetime({ offset: true }),
  break_minutes: z.number().int().min(0).optional(),
  hourly_wage: z.coerce.number().min(0).max(9999999999.99),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(["open", "closed", "cancelled"]).optional(),
  cancel_reason: z.string().max(2000).optional().nullable(),
});

const bodySchema = z.union([
  z.array(shiftSchema).min(1),
  z.object({ shifts: z.array(shiftSchema).min(1) }),
]);

type ShiftInput = z.infer<typeof shiftSchema>;

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    const user = await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);

    const body = await parseJson(request, bodySchema);
    const shifts = Array.isArray(body) ? body : body.shifts;

    const rows = shifts.map((shift: ShiftInput) => ({
      id: shift.id,
      company_id: companyId,
      location_id: shift.location_id,
      employee_id: shift.employee_id,
      role_id: shift.role_id,
      start_at: shift.start_at,
      end_at: shift.end_at,
      break_minutes: shift.break_minutes ?? 0,
      hourly_wage: shift.hourly_wage,
      notes: shift.notes ?? null,
      created_by: user.id,
      ...(shift.status ? { status: shift.status } : {}),
      ...(shift.cancel_reason !== undefined ? { cancel_reason: shift.cancel_reason ?? null } : {}),
    }));

    const rowsWithId = rows.filter((row) => typeof row.id === "string");
    const rowsWithoutId = rows.filter((row) => !row.id).map(({ id: _id, ...rest }) => rest);

    const written: unknown[] = [];

    if (rowsWithId.length > 0) {
      const { data, error } = await supabase
        .from("shifts")
        .upsert(rowsWithId, { onConflict: "id" })
        .select(
          "id, company_id, location_id, employee_id, role_id, start_at, end_at, break_minutes, hourly_wage, notes, status, cancel_reason, cancelled_at, closed_at, created_by, created_at, updated_at",
        );

      if (error) {
        throw new HttpError(400, error.message);
      }

      written.push(...(data ?? []));
    }

    if (rowsWithoutId.length > 0) {
      const { data, error } = await supabase
        .from("shifts")
        .insert(rowsWithoutId)
        .select(
          "id, company_id, location_id, employee_id, role_id, start_at, end_at, break_minutes, hourly_wage, notes, status, cancel_reason, cancelled_at, closed_at, created_by, created_at, updated_at",
        );

      if (error) {
        throw new HttpError(400, error.message);
      }

      written.push(...(data ?? []));
    }

    return jsonOk(written);
  } catch (error) {
    return handleRouteError(error);
  }
}
