import { z } from "zod";
import { getServerSupabase, requireUser } from "../../../../lib/auth";
import { handleRouteError, HttpError, jsonOk, parseJson } from "../../../../lib/http";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(160),
  locale: z.enum(["tr-TR", "en-US", "ar-EG"]).optional().default("tr-TR"),
  currency: z.enum(["TRY", "USD", "EGP"]).optional().default("TRY"),
});

function isColumnMissingError(error: { message?: string; code?: string } | null) {
  if (!error) {
    return false;
  }
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42703"
    || error.code === "PGRST204"
    || message.includes("column")
    || message.includes("does not exist")
    || message.includes("schema cache")
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    const user = await requireUser(supabase);
    const body = await parseJson(request, bodySchema);

    const { data: existing, error: existingError } = await supabase
      .from("companies")
      .select("id, name, owner_user_id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (existingError) {
      throw new HttpError(400, existingError.message);
    }

    if (existing) {
      const fullPayload = { name: body.name, locale: body.locale, currency: body.currency };
      const { data, error } = await supabase
        .from("companies")
        .update(fullPayload)
        .eq("id", existing.id)
        .eq("owner_user_id", user.id)
        .select("id, name, locale, currency")
        .single();

      if (isColumnMissingError(error)) {
        const basic = await supabase
          .from("companies")
          .update({ name: body.name })
          .eq("id", existing.id)
          .eq("owner_user_id", user.id)
          .select("id, name")
          .single();

        if (basic.error) {
          throw new HttpError(400, basic.error.message);
        }

        return jsonOk({
          ...basic.data,
          locale: body.locale ?? "tr-TR",
          currency: body.currency ?? "TRY",
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
    }

    const fullPayload = {
      name: body.name,
      owner_user_id: user.id,
      locale: body.locale,
      currency: body.currency,
    };
    const { data, error } = await supabase
      .from("companies")
      .insert(fullPayload)
      .select("id, name, locale, currency")
      .single();

    if (isColumnMissingError(error)) {
      const basic = await supabase
        .from("companies")
        .insert({ name: body.name, owner_user_id: user.id })
        .select("id, name")
        .single();

      if (basic.error) {
        throw new HttpError(400, basic.error.message);
      }

      return jsonOk(
        {
          ...basic.data,
          locale: body.locale ?? "tr-TR",
          currency: body.currency ?? "TRY",
          warning: "Company settings columns are not available yet (locale/currency not persisted).",
        },
        201,
      );
    }

    if (error) {
      throw new HttpError(400, error.message);
    }

    return jsonOk(
      {
        ...data,
        locale: data.locale ?? body.locale ?? "tr-TR",
        currency: data.currency ?? body.currency ?? "TRY",
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
