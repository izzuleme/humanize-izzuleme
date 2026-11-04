
import "server-only";
import crypto from "node:crypto";
import { db, BUCKET } from "./supabaseAdmin";

const MAX = {
  document: 20 * 1048576,
  receipt: 10 * 1048576,
};

export async function preparePendingUpload({
  uploadId,
  customerId,
  submissionKey,
  kind,
}) {
  if (!["document", "receipt"].includes(kind)) {
    throw new Error("Invalid upload type.");
  }

  const { data: record, error } = await db
    .from("pending_uploads")
    .select("*")
    .eq("id", uploadId)
    .eq("owner_id", customerId)
    .eq("submission_key", submissionKey)
    .eq("kind", kind)
    .eq("status", "completed")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !record || !record.sha256) {
    throw new Error("Upload not verified or expired.");
  }

  const { data: file, error: downloadError } =
    await db.storage.from(BUCKET).download(record.storage_path);

  if (downloadError || !file) {
    throw new Error("Uploaded file could not be found.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (
    buffer.length !== Number(record.size_bytes) ||
    buffer.length > MAX[kind]
  ) {
    throw new Error("Uploaded file size has changed.");
  }

  const sha256 = crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");

  if (sha256 !== record.sha256) {
    throw new Error("Uploaded file has changed. Please upload again.");
  }

  const folder = kind === "document" ? "original" : "receipt";

  const path =
    `orders/${submissionKey}/${folder}/` +
    `${crypto.randomUUID()}-${record.filename}`;

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: record.mime,
      upsert: false,
    });

  if (uploadError) {
    throw new Error("Could not save the verified file.");
  }

  return {
    uploadId: record.id,
    path,
    filename: record.filename,
    size: buffer.length,
    mime: record.mime,
    sha256,
  };
}
