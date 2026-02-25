import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../../lib/auth";
import { handleRouteError, HttpError, jsonOk, parseJson } from "../../../../lib/http";

const bodySchema = z.object({
  locale: z.enum(["tr-TR", "en-US", "ar-EG"]).optional(),
  currency: z.enum(["TRY", "USD", "EGP"]).optional(),
});

function isColumnMissingError(error: { message?: string; code?: string } | null) {
  if (!error) {
    return false;
  }
  const msg = error.message?.toLowerCase() ?? "";
  const couldNotFindSchemaThing =
    msg.includes("could not find the") && (msg.includes("schema") || msg.includes("cache") || msg.includes("column"));
  return (
    error.code === "42703"
    || error.code === "PGRST204"
    || msg.includes("column")
    || msg.includes("does not exist")
    || msg.includes("schema cache")
    || msg.includes("not found in schema cache")
    || couldNotFindSchemaThing
  );
}

export async function GET() {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);

    const { data, error } = await supabase
      .from("companies")
      .select("id, name, locale, currency")
      .eq("id", companyId)
      .single();

    if (isColumnMissingError(error)) {
      const fallback = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", companyId)
        .single();

      if (fallback.error) {
        throw new HttpError(400, fallback.error.message);
      }

      return jsonOk({ ...fallback.data, locale: "tr-TR", currency: "TRY" });
    }

    if (error) {
      throw new HttpError(400, error.message);
    }

    return jsonOk(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);
    const body = await parseJson(request, bodySchema);

    const patch: Partial<z.infer<typeof bodySchema>> = {};
    if (body.locale) {
      patch.locale = body.locale;
    }
    if (body.currency) {
      patch.currency = body.currency;
    }

    if (Object.keys(patch).length === 0) {
      throw new HttpError(400, "At least one field is required");
    }

    const { data, error } = await supabase
      .from("companies")
      .update(patch)
      .eq("id", companyId)
      .select("id, name, locale, currency")
      .single();

    if (isColumnMissingError(error)) {
      const fallback = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", companyId)
        .single();

      if (fallback.error) {
        throw new HttpError(400, fallback.error.message);
      }

      return jsonOk({
        ...fallback.data,
        locale: "tr-TR",
        currency: "TRY",
        warning: "Company settings columns are not available yet (locale/currency not persisted).",
      });
    }

    if (error) {
      throw new HttpError(400, error.message);
    }

    return jsonOk({
      ...data,
      locale: data.locale ?? body.locale ?? "tr-TR",
      currency: data.currency ?? body.currency ?? "TRY",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
