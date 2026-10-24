export function cleanName(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().replace(/\s+/g, " ");
  return v.length >= 1 && v.length <= 80 ? v : null;
}

// Stored as digits only with country code, e.g. 60123456789 (same format as
// the existing rows), because the rotation builds https://wa.me/<phone>.
export function cleanPhoneInput(value) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[\s+\-()]/g, "");
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

export function cleanUsername(value) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return /^[A-Za-z0-9_.-]{3,32}$/.test(v) ? v : null;
}

// bcrypt only uses the first 72 bytes, so cap there.
export function cleanNewPassword(value) {
  if (typeof value !== "string") return null;
  const bytes = Buffer.byteLength(value, "utf8");
  return value.length >= 8 && bytes <= 72 ? value : null;
}

export function toDbId(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
