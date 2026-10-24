import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, requireApiRole } from "@/lib/guards";
import { hashPassword } from "@/lib/password";
import { cleanNewPassword, cleanUsername, toDbId } from "@/lib/validate";

// Create or reset the login of a worker. The role is always "worker": there is
// deliberately no way to create or promote an admin from the browser.
// Requires the SQL migration (worker_accounts.password_hash).
export async function PUT(request, { params }) {
  const guard = await requireApiRole(request, "admin", { mutating: true });
  if (guard.response) return guard.response;

  const workerId = toDbId((await params).id);
  if (!workerId) return jsonError("ID worker tidak sah.", 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Permintaan tidak sah.", 400);
  }

  const supabase = getSupabaseAdmin();

  const { data: worker, error: workerError } = await supabase
    .from("workers")
    .select("id")
    .eq("id", workerId)
    .maybeSingle();
  if (workerError) return jsonError("Server error.", 500);
  if (!worker) return jsonError("Worker tidak dijumpai.", 404);

  const password = cleanNewPassword(body?.password);
  if (!password) {
    return jsonError("Password mesti sekurang-kurangnya 8 aksara (maksimum 72 bait).", 400);
  }

  const { data: existing, error: existingError } = await supabase
    .from("worker_accounts")
    .select("id, username")
    .eq("worker_id", workerId)
    .eq("role", "worker");
  if (existingError) {
    console.error("account lookup failed:", existingError.code);
    return jsonError("Server error.", 500);
  }
  if ((existing || []).length > 1) {
    return jsonError("Worker ini mempunyai lebih daripada satu akaun. Semak pangkalan data.", 409);
  }

  const password_hash = await hashPassword(password);

  // ---- reset password / rename existing account ----
  if (existing && existing.length === 1) {
    const account = existing[0];
    const update = { password_hash, password: null };

    if (body?.username != null && body.username !== account.username) {
      const username = cleanUsername(body.username);
      if (!username) return jsonError("Username tidak sah (3-32 aksara: huruf, nombor, _ . -).", 400);
      update.username = username;
    }

    const { error } = await supabase
      .from("worker_accounts")
      .update(update)
      .eq("id", account.id)
      .eq("role", "worker");

    if (error) {
      console.error("account update failed:", error.code);
      if (error.code === "23505") return jsonError("Username itu sudah digunakan.", 409);
      return jsonError("Gagal mengemas kini akaun. Pastikan migrasi SQL telah dijalankan.", 500);
    }

    return NextResponse.json({ success: true, created: false });
  }

  // ---- create a new account ----
  const username = cleanUsername(body?.username);
  if (!username) {
    return jsonError("Username tidak sah (3-32 aksara: huruf, nombor, _ . -).", 400);
  }

  const { data: taken, error: takenError } = await supabase
    .from("worker_accounts")
    .select("id")
    .eq("username", username)
    .limit(1);
  if (takenError) return jsonError("Server error.", 500);
  if (taken && taken.length > 0) return jsonError("Username itu sudah digunakan.", 409);

  const { error } = await supabase.from("worker_accounts").insert({
    username,
    password_hash,
    role: "worker",
    worker_id: workerId,
  });

  if (error) {
    console.error("account create failed:", error.code);
    if (error.code === "23505") return jsonError("Username itu sudah digunakan.", 409);
    return jsonError("Gagal mencipta akaun. Pastikan migrasi SQL telah dijalankan.", 500);
  }

  return NextResponse.json({ success: true, created: true }, { status: 201 });
}
