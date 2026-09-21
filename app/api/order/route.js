import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  try {
    // Ambil worker yang ACTIVE sahaja
    const { data: workers, error: workersError } = await supabase
      .from("workers")
      .select("*")
      .eq("active", true)
      .order("id", { ascending: true });

    if (workersError) {
      return NextResponse.json(workersError, { status: 500 });
    }

    // Kalau tak ada worker aktif
    if (!workers || workers.length === 0) {
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
      return NextResponse.json(rotationError, { status: 500 });
    }

    const currentWorkerId = rotation.current_worker;

    // Cari worker semasa dalam senarai worker aktif
    let currentIndex = workers.findIndex(
      (worker) => worker.id === currentWorkerId
    );

    // Kalau worker dalam rotation dah tak aktif / dah delete
    if (currentIndex === -1) {
      currentIndex = 0;
    }

    // Worker yang akan terima customer sekarang
    const worker = workers[currentIndex];

    // Tambah jumlah order worker
    const { error: updateOrderError } = await supabase
      .from("workers")
      .update({
        orders: (worker.orders || 0) + 1,
      })
      .eq("id", worker.id);

    if (updateOrderError) {
      return NextResponse.json(updateOrderError, { status: 500 });
    }

    // Cari worker aktif seterusnya
    const nextIndex = (currentIndex + 1) % workers.length;
    const nextWorker = workers[nextIndex];

    // Simpan giliran baru
    const { error: updateRotationError } = await supabase
      .from("rotation")
      .update({
        current_worker: nextWorker.id,
      })
      .eq("id", 1);

    if (updateRotationError) {
      return NextResponse.json(updateRotationError, { status: 500 });
    }

    // Template WhatsApp
    const message = `Hi, saya nak order Humanize English.

From page ? to ? :
Ayat (Academic / Standard) :
Nak siap before? :
Total pages :
Phone number :

📎 Saya akan hantar assignment selepas isi template ini.`;

    const whatsappUrl =
      `https://wa.me/${worker.phone}?text=${encodeURIComponent(message)}`;

    return NextResponse.redirect(whatsappUrl);

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}