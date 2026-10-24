// Best-effort in-memory login throttling. On serverless hosting (e.g. Vercel)
// each instance has its own memory, so this slows down casual brute force but
// is NOT a hard guarantee. For stronger protection use a shared store.

const buckets = new Map();
const WINDOW_MS = 15 * 60 * 1000;

function prune(now) {
  if (buckets.size < 5000) return;
  for (const [key, b] of buckets) {
    if (now - b.start > WINDOW_MS) buckets.delete(key);
  }
}

export function checkLimit(key, max, now = Date.now()) {
  prune(now);
  const b = buckets.get(key);
  if (!b || now - b.start > WINDOW_MS) return { allowed: true, retryAfter: 0 };
  if (b.count >= max) {
    return {
      allowed: false,
      retryAfter: Math.ceil((b.start + WINDOW_MS - now) / 1000),
    };
  }
  return { allowed: true, retryAfter: 0 };
}

export function recordFailure(key, now = Date.now()) {
  const b = buckets.get(key);
  if (!b || now - b.start > WINDOW_MS) {
    buckets.set(key, { count: 1, start: now });
  } else {
    b.count += 1;
  }
}

export function clearKey(key) {
  buckets.delete(key);
}

export function clientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
