import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanPhone, eligibleWorkers, pickTurn } from "@/lib/rotation";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Ambil worker yang ACTIVE sahaja (dan ada nombor telefon yang sah)
    const { data: activeWorkers, error: workersError } = await supabase
      .from("workers")
      .select("*")
      .eq("active", true)
      .order("id", { ascending: true });

    if (workersError) {
      console.error("rotation: workers query failed:", workersError.code);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const workers = eligibleWorkers(activeWorkers);

    // Kalau tak ada worker aktif
    if (workers.length === 0) {
      return NextResponse.json(
        { error: "Tiada worker yang sedang aktif." },
        { status: 404 }
      );
    }

    // Ambil giliran semasa
    const { data: rotation, error: rotationError } = await supabase
      .from("rotation")
      .select("*")
      .eq("id", 1)
      .single();

    if (rotationError) {
      console.error("rotation: rotation query failed:", rotationError.code);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    // Worker yang akan terima customer sekarang + worker seterusnya.
    // Kalau worker dalam rotation dah tak aktif / dah delete, teruskan dengan
    // worker aktif yang id-nya selepas itu (id tidak semestinya berturutan).
    const { current: worker, next: nextWorker } = pickTurn(
      workers,
      rotation.current_worker
    );

    // Tambah jumlah order worker
    const { error: updateOrderError } = await supabase
      .from("workers")
      .update({
        orders: (worker.orders || 0) + 1,
      })
      .eq("id", worker.id);

    if (updateOrderError) {
      console.error("rotation: order count update failed:", updateOrderError.code);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    // Simpan giliran baru
    const { error: updateRotationError } = await supabase
      .from("rotation")
      .update({
        current_worker: nextWorker.id,
      })
      .eq("id", 1);

    if (updateRotationError) {
      console.error("rotation: rotation update failed:", updateRotationError.code);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    // Template WhatsApp
    const message = `Hi, saya nak order Humanize English.

From page ? to ? :
Ayat (Academic / Standard) :
Nak siap before? :
Turnitin (YES (similarity or ai?) / NO (Humanize Only) :
Total pages :
Phone number :

📎 Saya akan hantar assignment selepas isi template ini.`;

    const whatsappUrl =
      `https://wa.me/${cleanPhone(worker.phone)}?text=${encodeURIComponent(message)}`;

    return NextResponse.redirect(whatsappUrl);

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
