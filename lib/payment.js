// Pure helpers, safe to import from server AND client code. No secrets here.
export const PAYMENT_STATUS = {
  awaiting_payment: ["Awaiting Payment", "bg-amber-100 text-amber-800"],
  receipt_submitted: ["Receipt Submitted", "bg-blue-100 text-blue-800"],
  under_verification: ["Payment Under Verification", "bg-indigo-100 text-indigo-800"],
  rejected: ["Payment Rejected", "bg-red-100 text-red-800"],
  paid: ["Paid", "bg-green-200 text-green-900"],
  failed: ["Payment Failed", "bg-red-100 text-red-800"],
  expired: ["Payment Expired", "bg-slate-200 text-slate-700"],
  refunded: ["Refunded", "bg-slate-200 text-slate-700"],
};

// 0123456789 / +60 12-345 6789 / 60123456789  ->  60123456789
export function normalizePhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "6" + d;
  return d;
}
export const validPhone = (d) => /^\d{9,15}$/.test(d);

export const refCode = (key) => String(key).replace(/-/g, "").slice(0, 8).toUpperCase();

export function pageCount(from, to) {
  const n = Number(to) - Number(from) + 1;
  return Number.isInteger(n) && n > 0 ? n : 0;
}
// Display only. The authoritative price is computed inside create_manual_order() in SQL.
export function estimatePrice(pages, style, rates) {
  const rate = style === "academic" ? rates.academic : rates.standard;
  return Math.round(pages * Number(rate) * 100) / 100;
}

export function whatsappLink(number, text) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
export const pay = (o) => (Array.isArray(o?.payments) ? o.payments[0] : o?.payments) || null;
