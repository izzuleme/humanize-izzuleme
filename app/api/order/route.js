import { NextResponse } from "next/server";
import { db } from "@/lib/supabaseAdmin";

// Public "Order on WhatsApp" button. Behaviour is unchanged (redirect to the next worker's
// WhatsApp with the template) but the rotation is now atomic in SQL and skips workers who
// are unavailable or whose account is inactive/suspended.
export async function GET() {
  const { data, error } = await db.rpc("next_rotation_worker");
  const worker = Array.isArray(data) ? data[0] : data;
  if (error || !worker?.phone) {
    return NextResponse.json({ error: "No worker is available right now. Please try again shortly." }, { status: 503 });
  }

  const message = `Hi, saya nak order Humanize English.

From page ? to ? :
Ayat (Academic / Standard) :
Nak siap before? :
Total pages :
Phone number :

📎 Saya akan hantar assignment selepas isi template ini.`;

  return NextResponse.redirect(`https://wa.me/${worker.phone}?text=${encodeURIComponent(message)}`);
}
