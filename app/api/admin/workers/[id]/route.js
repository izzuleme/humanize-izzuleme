import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, requireApiRole } from "@/lib/guards";
import { cleanName, cleanPhoneInput, toDbId } from "@/lib/validate";

// Update name / phone / active flag of one worker. Nothing else is writable
// here (in particular not `orders`, which the rotation maintains).
export async function PATCH(request, { params }) {
  const guard = await requireApiRole(request, "admin", { mutating: true });
  if (guard.response) return guard.response;

  const id = toDbId((await params).id);
  if (!id) return jsonError("ID worker tidak sah.", 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Permintaan tidak sah.", 400);
  }

  const update = {};

  if ("name" in body) {
    const name = cleanName(body.name);
    if (!name) return jsonError("Nama worker tidak sah.", 400);
    update.name = name;
  }
  if ("phone" in body) {
    const phone = cleanPhoneInput(body.phone);
    if (!phone) return jsonError("Nombor telefon tidak sah.", 400);
    update.phone = phone;
  }
  if ("active" in body) {
    if (typeof body.active !== "boolean") {
      return jsonError("Status active tidak sah.", 400);
    }
    update.active = body.active;
  }

  if (Object.keys(update).length === 0) {
    return jsonError("Tiada perubahan diberikan.", 400);
  }

  const { data, error } = await getSupabaseAdmin()
    .from("workers")
    .update(update)
    .eq("id", id)
    .select("id, name, phone, active, orders")
    .maybeSingle();

  if (error) {
    console.error("update worker failed:", error.code);
    return jsonError("Gagal mengemas kini worker.", 500);
  }
  if (!data) return jsonError("Worker tidak dijumpai.", 404);

  return NextResponse.json({ success: true, worker: data });
}
