import { input } from "./ActionForm";

// Shared by the worker's own settings form and the admin's worker form.
export default function SettingsFields({ w, withRate = false }) {
  const f = (name, label, props) => (
    <label className="block text-sm font-medium text-slate-700">{label}
      <input name={name} className={input + " mt-1"} required {...props} />
    </label>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {f("max_orders_per_day", "Max orders per day", { type: "number", min: 0, max: 100, defaultValue: w?.max_orders_per_day ?? 5 })}
      {f("max_pages_per_day", "Max pages per day", { type: "number", min: 0, max: 2000, defaultValue: w?.max_pages_per_day ?? 50 })}
      {f("work_start", "Working hours: from", { type: "time", defaultValue: (w?.work_start ?? "09:00").slice(0, 5) })}
      {f("work_end", "Working hours: until", { type: "time", defaultValue: (w?.work_end ?? "23:00").slice(0, 5) })}
      {withRate && f("pay_rate_per_page", "Pay rate per page (RM)", { type: "number", min: 0, step: "0.01", defaultValue: w?.pay_rate_per_page ?? 0 })}
    </div>
  );
}
