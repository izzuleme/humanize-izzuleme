"use client";
import { useActionState, useEffect, useState, startTransition } from "react";
import { createOrderAction, getPaymentInstructionsAction, checkSlotAvailabilityAction } from "@/app/actions/customer";
import { btn, input } from "./ActionForm";
import { pageCount, estimatePrice, refCode, whatsappLink } from "@/lib/payment";

const lbl = "block text-sm font-medium text-slate-700";

export default function NewOrderForm({ customerName, defaultPhone, whatsapp, rates }) {
  const [state, formAction, pending] = useActionState(createOrderAction, null);
  const [key, setKey] = useState("");
  useEffect(() => setKey(crypto.randomUUID()), []); // one key per page load = duplicate-submit protection
  const [f, setF] = useState({ title: "", from_page: "", to_page: "", total_pages: "", style: "standard", deadline: "", phone: defaultPhone || "", requirements: "" });
  const [contacted, setContacted] = useState(false);
  const [info, setInfo] = useState(null);
  const [hasReceipt, setHasReceipt] = useState(false);
const [slot, setSlot] = useState({
  checking: false,
  available: false,
  message: "",
});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const pages = pageCount(f.from_page, f.to_page);
  const price = estimatePrice(pages, f.style, rates);
  const canQuote = pages > 0 && f.title.trim().length >= 3 && f.deadline && f.total_pages && Number(f.total_pages) >= Number(f.to_page);
useEffect(() => {
  let cancelled = false;

  async function checkSlot() {
    if (!f.deadline || pages <= 0) {
      setSlot({
        checking: false,
        available: false,
        message: "",
      });
      return;
    }

    setSlot({
      checking: true,
      available: false,
      message: "Checking availability...",
    });

    const result = await checkSlotAvailabilityAction(f.deadline, pages);

    if (cancelled) return;

    setSlot({
      checking: false,
      available: result.available,
      message: result.message,
    });
  }

  const timer = setTimeout(checkSlot, 500);

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}, [f.deadline, pages]);

  async function payViaWhatsApp() {
    const when = new Date(f.deadline + "+08:00").toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" });
    const msg = [
      "Hi, I would like to place an order.",
      `Ref: ${refCode(key)}`, `Name: ${customerName}`, `Title: ${f.title.trim()}`,
      `Pages: ${f.from_page} to ${f.to_page} (${pages} pages, document total ${f.total_pages})`,
      `Style: ${f.style === "academic" ? "Academic" : "Standard"}`, `Deadline: ${when}`,
      `Price: RM${price.toFixed(2)}`, "", "Please send me the payment instructions.",
    ].join("\n");
    const waUrl = whatsappLink(whatsapp, msg);
const waWindow = window.open("about:blank", "_blank");

if (waWindow) {
  waWindow.opener = null;
  waWindow.location.href = waUrl;
} else {
  window.location.href = waUrl;
}
    setContacted(true);
    setInfo(await getPaymentInstructionsAction());
  }

  function onSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("submission_key", key);
    startTransition(() => formAction(fd)); // keeps the typed fields if the server rejects something
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className={lbl}>Order title<input name="title" value={f.title} onChange={set("title")} required maxLength={150} className={input + " mt-1"} /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={lbl}>From page<input name="from_page" type="number" min="1" value={f.from_page} onChange={set("from_page")} required className={input + " mt-1"} /></label>
        <label className={lbl}>To page<input name="to_page" type="number" min="1" value={f.to_page} onChange={set("to_page")} required className={input + " mt-1"} /></label>
        <label className={lbl}>Total pages in document<input name="total_pages" type="number" min="1" value={f.total_pages} onChange={set("total_pages")} required className={input + " mt-1"} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={lbl}>Writing style
          <select name="style" value={f.style} onChange={set("style")} className={input + " mt-1"}><option value="standard">Standard</option><option value="academic">Academic</option></select></label>
        <label className={lbl}>
  Deadline (Malaysia time)
  <input
    name="deadline"
    type="datetime-local"
    value={f.deadline}
    onChange={set("deadline")}
    required
    className={input + " mt-1"}
  />

  {slot.message && (
    <p
      className={`mt-1 text-xs font-medium ${
        slot.checking
          ? "text-slate-500"
          : slot.available
          ? "text-emerald-600"
          : "text-red-600"
      }`}
    >
      {slot.message}
    </p>
  )}
</label>
      </div>
      <label className={lbl}>Your WhatsApp number<input name="phone" value={f.phone} onChange={set("phone")} required placeholder="e.g. 0123456789" className={input + " mt-1"} /></label>
      <label className={lbl}>Original document (DOC, DOCX or PDF, max 20MB)
        <input
  name="document"
  type="file"
  accept=".pdf,.doc,.docx"
  required
  className="mt-2 block w-full cursor-pointer rounded-xl border border-blue-200 bg-blue-50 text-sm font-medium text-slate-700 shadow-sm file:mr-4 file:border-0 file:bg-blue-600 file:px-4 file:py-3 file:font-bold file:text-white hover:file:bg-blue-700"
/></label>
      <label className={lbl}>Notes for the worker (optional)<textarea name="requirements" value={f.requirements} onChange={set("requirements")} rows={3} maxLength={3000} className={input + " mt-1"} /></label>

      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-sm text-slate-600">Order price</p>
        <p className="text-3xl font-black">{pages > 0 ? `RM${price.toFixed(2)}` : "-"}</p>
        <p className="text-xs text-slate-500">{pages > 0 ? `${pages} pages × RM${(f.style === "academic" ? rates.academic : rates.standard).toFixed(2)}` : "Enter the page range to see your price."}</p>
        <button type="button" onClick={payViaWhatsApp} disabled={!canQuote || slot.checking || !slot.available} className={btn + " mt-3 bg-[#25D366] hover:bg-[#20ba5a]"}>
          {contacted ? "Open WhatsApp again" : "Pay via WhatsApp"}
        </button>
        {!canQuote && <p className="mt-2 text-xs text-slate-500">Fill in the title, pages and deadline first.</p>}
      </div>

      {info && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm">
          <p className="font-bold">Payment details</p>
          {info.bank_name && <p>Bank: {info.bank_name}</p>}
          {info.account_holder && <p>Account name: {info.account_holder}</p>}
          {info.account_number && <p>Account number: <b>{info.account_number}</b></p>}
          {info.payment_methods && <p>Accepted: {info.payment_methods}</p>}
          {info.instructions && <p className="mt-2 whitespace-pre-wrap">{info.instructions}</p>}
          <p className="mt-2 text-xs text-slate-600">Always confirm the details with the admin on WhatsApp. Quote reference {refCode(key)}.</p>
        </div>
      )}

      {contacted ? (
        <label className={lbl}>Payment receipt (PDF, PNG or JPG, max 10MB), required to submit
          <input
  name="receipt"
  type="file"
  accept=".pdf,.png,.jpg,.jpeg"
  required
  onChange={(e) => setHasReceipt(!!e.target.files?.length)}
  className="mt-2 block w-full cursor-pointer rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-medium text-slate-700 shadow-sm file:mr-4 file:border-0 file:bg-emerald-600 file:px-4 file:py-3 file:font-bold file:text-white hover:file:bg-emerald-700"
/></label>
      ) : (
        <p className="text-sm text-slate-500">After contacting the admin and paying, you will upload your receipt here.</p>
      )}

      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending || !key || !contacted || !hasReceipt} className={btn}>{pending ? "Submitting…" : "Submit order"}</button>
      <p className="text-xs text-slate-500">Your order is only passed to a worker after the admin verifies your payment.</p>
    </form>
  );
}
