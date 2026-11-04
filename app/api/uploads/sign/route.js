
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSession } from "@/lib/auth";
import { db, BUCKET } from "@/lib/supabaseAdmin";
import { isUuid } from "@/lib/validate";

export const runtime = "nodejs";

const TYPES = {
  document: {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  receipt: {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  },
};

export async function POST(request) {
  try {
    const session = await getSession();

    if (!session || session.role !== "customer") {
      return NextResponse.json(
        { error: "Please log in as a customer." },
        { status: 401 }
      );
    }

    if (session.mustChange) {
      return NextResponse.json(
        { error: "Please change your password first." },
        { status: 403 }
      );
    }

    const origin = request.headers.get("origin");
    const expectedOrigin = new URL(request.url).origin;

    if (!origin || origin !== expectedOrigin) {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { filename, size, kind, submissionKey } = body;

    if (
      !["document", "receipt"].includes(kind) ||
      !isUuid(submissionKey)
    ) {
      return NextResponse.json(
        { error: "Invalid upload request." },
        { status: 400 }
      );
    }

    const name = String(filename || "");
    const ext = name.split(".").pop().toLowerCase();
    const mime = TYPES[kind][ext];
    const maxBytes =
      kind === "document" ? 20 * 1048576 : 10 * 1048576;

    if (
      !mime ||
      !Number.isSafeInteger(size) ||
      size <= 0 ||
      size > maxBytes ||
      name.length > 255
    ) {
      return NextResponse.json(
        { error: "Invalid file type or size." },
        { status: 400 }
      );
    }

    const { count, error: countError } = await db
      .from("pending_uploads")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", session.accountId)
      .gte(
        "created_at",
        new Date(Date.now() - 3600000).toISOString()
      );

    if (countError) {
      console.error("Upload limit check:", countError);
      return NextResponse.json(
        { error: "Could not prepare upload." },
        { status: 500 }
      );
    }

    if (count >= 20) {
      return NextResponse.json(
        { error: "Too many uploads. Please try later." },
        { status: 429 }
      );
    }

    const safeName =
      name.replace(/[^\w.\- ]+/g, "_")
        .replace(/\.{2,}/g, ".")
        .slice(-120) || "file";

    const path =
      `pending/${session.accountId}/${submissionKey}/${kind}/` +
      `${crypto.randomUUID()}-${safeName}`;

    const { error: insertError } = await db
      .from("pending_uploads")
      .insert({
        owner_id: session.accountId,
        submission_key: submissionKey,
        kind,
        storage_path: path,
        filename: safeName,
        size_bytes: size,
        mime,
        status: "pending",
      });

    if (insertError) {
      console.error("Pending upload insert:", insertError);
      return NextResponse.json(
        { error: "Could not record upload." },
        { status: 500 }
      );
    }

    const { data, error } = await db.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data?.token) {
      console.error("Signed upload error:", error);

      await db
        .from("pending_uploads")
        .delete()
        .eq("storage_path", path);

      return NextResponse.json(
        { error: "Could not prepare upload." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { path, token: data.token, mime },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Upload signing error:", error);

    return NextResponse.json(
      { error: "Could not prepare upload." },
      { status: 500 }
    );
  }
}
