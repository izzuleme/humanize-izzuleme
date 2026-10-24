// The `orders` table is empty, so the real values of `status` and
// `payment_status` are unknown. Change these if your values differ.
// An order counts as completed when completed_at is set (that column exists).
export const PAID_STATUSES = ["paid"];

export function isCompleted(order) {
  return Boolean(order.completed_at);
}

export function isPaid(order) {
  return PAID_STATUSES.includes(String(order.payment_status || "").toLowerCase());
}

// Start of "today" in Malaysia time (UTC+8, no DST) as an ISO string.
export function startOfTodayMY(now = new Date()) {
  const offsetMs = 8 * 60 * 60 * 1000;
  const my = new Date(now.getTime() + offsetMs);
  my.setUTCHours(0, 0, 0, 0);
  return new Date(my.getTime() - offsetMs).toISOString();
}
