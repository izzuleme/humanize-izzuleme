import { NextResponse } from "next/server";
import { db, BUCKET } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { isUuid } from "@/lib/validate";

// Every document download passes through here. Storage bucket is private; the browser
// only ever receives a 60-second signed URL AFTER the permission check below.
export async function GET(_req, { params }) {
  const { id } = await params;
  const s = await getSession();
  if (!s || !isUuid(id)) return new NextResponse("Not found", { status: 404 });

  const { data: f } = await db.from("order_files").select("*, orders(customer_id, worker_id)").eq("id", id).maybeSingle();
  if (!f) return new NextResponse("Not found", { status: 404 });

  const o = f.orders;
  const allowed =
    s.role === "admin" ||
    (s.role === "worker" && s.workerId != null && String(o.worker_id) === String(s.workerId)) ||
    (s.role === "customer" && o.customer_id === s.accountId);
  if (!allowed) return new NextResponse("Not found", { status: 404 }); // 404, not 403: don't reveal existence

  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(f.storage_path, 60, { download: f.filename });
  if (error || !data?.signedUrl) return new NextResponse("File unavailable", { status: 502 });
  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
