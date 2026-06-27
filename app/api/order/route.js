import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  // Ambil giliran semasa
  const { data: rotation, error: rotationError } = await supabase
    .from("rotation")
    .select("*")
    .eq("id", 1)
    .single();

  if (rotationError) {
    return NextResponse.json(rotationError, { status: 500 });
  }

  const currentWorker = rotation.current_worker;

  // Ambil worker
  const { data: worker, error: workerError } = await supabase
    .from("workers")
    .select("*")
    .eq("id", currentWorker)
    .single();

  if (workerError) {
    return NextResponse.json(workerError, { status: 500 });
  }

  // Tambah order worker
  await supabase
    .from("workers")
    .update({
      orders: worker.orders + 1,
    })
    .eq("id", currentWorker);

  // Kira worker seterusnya
  const { count } = await supabase
    .from("workers")
    .select("*", { count: "exact", head: true });

  let nextWorker = currentWorker + 1;

  if (nextWorker > count) {
    nextWorker = 1;
  }

  // Update rotation
  await supabase
    .from("rotation")
    .update({
      current_worker: nextWorker,
    })
    .eq("id", 1);

  const text = `Hi, saya nak order Humanize English.

From page ? to ? :
Ayat (Academic / Standard) :
Nak siap before? :
Total pages :
Phone number :

📎 Saya akan hantar assignment selepas isi template ini.`;

  const url =
    "https://wa.me/" +
    worker.phone +
    "?text=" +
    encodeURIComponent(text);

  return NextResponse.redirect(url);
}