
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSession } from "@/lib/auth";
import { db, BUCKET } from "@/lib/supabaseAdmin";
import { isUuid } from "@/lib/validate";

export const runtime = "nodejs";

const MAX = {
  document: 20 * 1048576,
  receipt: 10 * 1048576,
};

function matchesSignature(buffer, mime) {
  if (mime === "application/pdf") {
    return buffer.subarray(0, 5).toString() === "%PDF-";
  }

  if (mime === "image/png") {
    return buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
  }

  if (mime === "image/jpeg") {
    return buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
  }

  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return buffer.subarray(0, 2).toString() === "PK";
  }

  if (mime === "application/msword") {
    return buffer.subarray(0, 8).equals(
      Buffer.from([208, 207, 17, 224, 161, 177, 26, 225])
    );
  }

  return false;
}

export async function POST(request) {
  try {
    const session = await getSession();

    if (!session || session.role !== "customer") {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 }
      );
    }

    const { path, submissionKey, kind } = await request.json();

    if (
      !isUuid(submissionKey) ||
      !["document", "receipt"].includes(kind) ||
      typeof path !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid upload." },
        { status: 400 }
      );
    }

    const { data: record, error: lookupError } = await db
      .from("pending_uploads")
      .select("*")
      .eq("storage_path", path)
      .eq("owner_id", session.accountId)
      .eq("submission_key", submissionKey)
      .eq("kind", kind)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (lookupError || !record) {
      return NextResponse.json(
        { error: "Upload not found or expired." },
        { status: 404 }
      );
    }

    const { data: file, error: downloadError } =
      await db.storage.from(BUCKET).download(record.storage_path);

    if (downloadError || !file) {
      return NextResponse.json(
        { error: "Uploaded file not found." },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (
      buffer.length !== Number(record.size_bytes) ||
      buffer.length > MAX[kind] ||
      !matchesSignature(buffer, record.mime)
    ) {
      return NextResponse.json(
        { error: "File content or size is invalid." },
        { status: 400 }
      );
    }

    const sha256 = crypto
      .createHash("sha256")
      .update(buffer)
      .digest("hex");

    const { data: updated, error: updateError } = await db
  .from("pending_uploads")
  .update({
    status: "completed",
    sha256,
  })
  .eq("id", record.id)
  .eq("owner_id", session.accountId)
  .eq("status", "pending")
  .select("id")
  .maybeSingle();

if (!updateError && !updated) {
  return NextResponse.json(
    { error: "Upload was already processed. Please try again." },
    { status: 409 }
  );
}
    if (updateError) {
      return NextResponse.json(
        { error: "Could not verify upload." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        verified: true,
        uploadId: record.id,
        sha256,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Verify upload error:", error);

    return NextResponse.json(
      { error: "Could not verify upload." },
      { status: 500 }
    );
  }
}
