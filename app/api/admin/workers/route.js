import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, requireApiRole } from "@/lib/guards";
import { cleanName, cleanPhoneInput } from "@/lib/validate";

// Create a worker (joins the WhatsApp rotation while active = true).
export async function POST(request) {
  const guard = await requireApiRole(request, "admin", { mutating: true });
  if (guard.response) return guard.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Permintaan tidak sah.", 400);
  }

  const name = cleanName(body?.name);
  const phone = cleanPhoneInput(body?.phone);
  if (!name) return jsonError("Nama worker tidak sah.", 400);
  if (!phone) {
    return jsonError("Nombor telefon tidak sah (contoh: 60123456789).", 400);
  }

  const { data, error } = await getSupabaseAdmin()
    .from("workers")
    .insert({ name, phone, active: true, orders: 0 })
    .select("id, name, phone, active, orders")
    .single();

  if (error) {
    console.error("create worker failed:", error.code);
    return jsonError("Gagal menambah worker.", 500);
  }

  return NextResponse.json({ success: true, worker: data }, { status: 201 });
}
