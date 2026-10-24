import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";
import { sameOriginOk } from "@/lib/guards";

export async function POST(request) {
  if (!sameOriginOk(request)) {
    return NextResponse.json(
      { success: false, message: "Request ditolak." },
      { status: 403 }
    );
  }

  const response = NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  return clearSessionCookie(response);
}
