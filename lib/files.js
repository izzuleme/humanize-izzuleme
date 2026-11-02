import "server-only";
import crypto from "node:crypto";
import { db, BUCKET } from "./supabaseAdmin";

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 10;
// MIME is derived from the extension on the server, never trusted from the browser.
const TYPES = {
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain", rtf: "application/rtf", odt: "application/vnd.oasis.opendocument.text",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
};

function cleanName(name) {
  return String(name).replace(/[^\w.\- ]+/g, "_").replace(/\.{2,}/g, ".").slice(-120) || "file";
}

// Validates and stores File objects from a FormData. Returns { error } or { saved: [...] }.
export async function storeFiles({ orderId, kind, files, actor, revisionNo = 0 }) {
  const list = files.filter((f) => f && typeof f === "object" && f.size > 0);
  if (list.length > MAX_FILES) return { error: `Max ${MAX_FILES} files at a time.` };
  for (const f of list) {
    const ext = f.name.split(".").pop().toLowerCase();
    if (!TYPES[ext]) return { error: `File type .${ext} is not allowed.` };
    if (f.size > MAX_BYTES) return { error: `${f.name} is larger than 20MB.` };
  }
  const saved = [];
  for (const f of list) {
    const ext = f.name.split(".").pop().toLowerCase();
    const path = `orders/${orderId}/${kind}/${crypto.randomUUID()}-${cleanName(f.name)}`;
    const buf = Buffer.from(await f.arrayBuffer());
    const up = await db.storage.from(BUCKET).upload(path, buf, { contentType: TYPES[ext], upsert: false });
    if (up.error) { await db.storage.from(BUCKET).remove(saved); return { error: "Upload failed. Please try again." }; }
    const { error } = await db.from("order_files").insert({
      order_id: orderId, kind, storage_path: path, filename: cleanName(f.name),
      size_bytes: f.size, mime: TYPES[ext], revision_no: revisionNo, uploaded_by: actor,
    });
    if (error) {
      await db.storage.from(BUCKET).remove([...saved, path]);
      await db.from("order_files").delete().in("storage_path", saved);
      return { error: "Could not record the upload." };
    }
    saved.push(path);
  }
  return { saved };
}

// ---- raw upload helper used by the manual-payment flow --------------------
// Validates + uploads files to the private bucket and returns descriptors (with sha256).
// The CALLER writes the database rows (inside a SQL function, so it is atomic).
export const DOC_TYPES = ["pdf", "doc", "docx"];
export const RECEIPT_TYPES = ["pdf", "png", "jpg", "jpeg"];

export function checkFile(f, allowed, maxBytes, label) {
  if (!f || typeof f !== "object" || !f.size) return `Please choose the ${label}.`;
  const ext = String(f.name).split(".").pop().toLowerCase();
  if (!allowed.includes(ext)) return `${label}: only ${allowed.join(", ").toUpperCase()} files are allowed.`;
  if (f.size > maxBytes) return `${label} is larger than ${Math.round(maxBytes / 1048576)}MB.`;
  return null;
}

export async function uploadRaw({ orderKey, folder, file }) {
  const ext = file.name.split(".").pop().toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  const path = `orders/${orderKey}/${folder}/${crypto.randomUUID()}-${cleanName(file.name)}`;
  const up = await db.storage.from(BUCKET).upload(path, buf, { contentType: TYPES[ext], upsert: false });
  if (up.error) return null;
  return { path, filename: cleanName(file.name), size: file.size, mime: TYPES[ext], sha256 };
}

export async function removeUploaded(...descs) {
  const paths = descs.filter(Boolean).map((d) => d.path);
  if (paths.length) await db.storage.from(BUCKET).remove(paths);
}
