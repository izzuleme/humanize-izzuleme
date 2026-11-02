// All business days/weeks/months are Malaysia time.
const TZ = "Asia/Kuala_Lumpur";

export function dayKey(d) {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
}
export function weekKey(d) {
  const k = dayKey(d);
  const dt = new Date(k + "T00:00:00Z");
  const back = (dt.getUTCDay() + 6) % 7; // Monday start
  dt.setUTCDate(dt.getUTCDate() - back);
  return dt.toISOString().slice(0, 10);
}
export function monthKey(d) {
  return dayKey(d).slice(0, 7);
}
export function fmtDateTime(d) {
  if (!d) return "-";
  return new Date(d).toLocaleString("en-MY", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" });
}
export function startOfTodayISO() {
  return new Date(dayKey(new Date()) + "T00:00:00+08:00").toISOString();
}
export function money(n) {
  return "RM" + Number(n || 0).toFixed(2);
}

// Group payroll rows [{earned_at, amount}] by day/week/month, newest first.
export function groupPayroll(rows, keyFn, limit) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r.earned_at);
    const cur = m.get(k) || { key: k, total: 0, count: 0 };
    cur.total += Number(r.amount);
    cur.count += 1;
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => (a.key < b.key ? 1 : -1)).slice(0, limit);
}
