import { NextResponse } from "next/server";
import { db, BUCKET } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { isUuid } from "@/lib/validate";

// Receipts: ONLY the customer who owns the order, or an admin. Workers get 404.
export async function GET(_req, { params }) {
  const { id } = await params;
  const s = await getSession();
  if (!s || !isUuid(id) || !["admin", "customer"].includes(s.role)) return new NextResponse("Not found", { status: 404 });

  const { data: r } = await db.from("payment_receipts").select("storage_path, filename, orders(customer_id)").eq("id", id).maybeSingle();
  if (!r) return new NextResponse("Not found", { status: 404 });
  const allowed = s.role === "admin" || r.orders?.customer_id === s.accountId;
  if (!allowed) return new NextResponse("Not found", { status: 404 });

  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(r.storage_path, 60);
  if (error || !data?.signedUrl) return new NextResponse("File unavailable", { status: 502 });
  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
