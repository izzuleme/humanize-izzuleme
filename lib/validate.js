const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Shared by worker (own settings) and admin (any worker). Rate is admin-only.
export function parseWorkerSettings(fd, { withRate = false } = {}) {
  const maxOrders = Number(fd.get("max_orders_per_day"));
  const maxPages = Number(fd.get("max_pages_per_day"));
  const start = String(fd.get("work_start") || "");
  const end = String(fd.get("work_end") || "");
  if (!Number.isInteger(maxOrders) || maxOrders < 0 || maxOrders > 100) return { error: "Max orders per day must be 0–100." };
  if (!Number.isInteger(maxPages) || maxPages < 0 || maxPages > 2000) return { error: "Max pages per day must be 0–2000." };
  if (!HHMM.test(start) || !HHMM.test(end)) return { error: "Enter working hours as HH:MM." };
  const values = { max_orders_per_day: maxOrders, max_pages_per_day: maxPages, work_start: start, work_end: end };
  if (withRate) {
    const rate = Number(fd.get("pay_rate_per_page"));
    if (!Number.isFinite(rate) || rate < 0 || rate > 1000) return { error: "Pay rate must be between 0 and 1000." };
    values.pay_rate_per_page = Math.round(rate * 100) / 100;
  }
  return { values };
}

export const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v));
