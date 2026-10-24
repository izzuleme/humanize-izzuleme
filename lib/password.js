import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const BCRYPT_COST = 12;

// Hash of a random string nobody knows. Compared against when the username
// does not exist, so "unknown user" and "wrong password" take similar time.
const DUMMY_HASH = bcrypt.hashSync(
  crypto.randomBytes(16).toString("hex"),
  BCRYPT_COST
);

export function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyHash(plain, hash) {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export async function burnDummyCompare(plain) {
  await bcrypt.compare(plain, DUMMY_HASH);
}

// Constant-time comparison for the legacy plaintext column. Only used until a
// row has been migrated to password_hash.
export function verifyLegacyPlaintext(plain, stored) {
  if (typeof stored !== "string" || stored.length === 0) return false;
  const a = crypto.createHash("sha256").update(plain).digest();
  const b = crypto.createHash("sha256").update(stored).digest();
  return crypto.timingSafeEqual(a, b);
}
