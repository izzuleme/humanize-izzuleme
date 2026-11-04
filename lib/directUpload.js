
"use client";

import { supabaseBrowser } from "./supabaseBrowser";

export async function directUpload(file, kind, submissionKey) {
  if (!file || !submissionKey) {
    throw new Error("Please select a file and try again.");
  }

  const maxBytes =
    kind === "document" ? 20 * 1048576 : 10 * 1048576;

  if (file.size <= 0 || file.size > maxBytes) {
    throw new Error(
      kind === "document"
        ? "Document must be 20MB or smaller."
        : "Receipt must be 10MB or smaller."
    );
  }

  // Step 1: Request a signed upload token.
  const signResponse = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      filename: file.name,
      size: file.size,
      kind,
      submissionKey,
    }),
  });

  const signed = await signResponse.json();

  if (!signResponse.ok) {
    throw new Error(signed.error || "Could not prepare upload.");
  }

  // Step 2: Upload directly from the browser to Supabase.
  const { error: uploadError } = await supabaseBrowser.storage
    .from("order-files")
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: signed.mime,
      upsert: false,
    });

  if (uploadError) {
    throw new Error("File upload failed: " + uploadError.message);
  }

  // Step 3: Ask the server to verify the uploaded file.
  const verifyResponse = await fetch("/api/uploads/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      path: signed.path,
      kind,
      submissionKey,
    }),
  });

  const verified = await verifyResponse.json();

  if (!verifyResponse.ok || !verified.verified) {
    throw new Error(verified.error || "File verification failed.");
  }

  return verified.uploadId;
}
