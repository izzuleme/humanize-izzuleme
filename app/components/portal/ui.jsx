import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { PAYMENT_STATUS } from "@/lib/payment";

export const STATUS = {
  pending_payment_verification: ["Pending payment verification", "bg-amber-100 text-amber-800 ring-1 ring-amber-200"],
  pending_assignment: ["Waiting for worker", "bg-amber-100 text-amber-800 ring-1 ring-amber-200"],
  assigned: ["Assigned", "bg-blue-100 text-blue-800 ring-1 ring-blue-200"],
  in_progress: ["In progress", "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200"],
  delivered: ["Delivered", "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"],
  revision_requested: ["Revision requested", "bg-orange-100 text-orange-800 ring-1 ring-orange-200"],
  approved: ["Completed", "bg-green-100 text-green-800 ring-1 ring-green-200"],
  cancelled: ["Cancelled", "bg-slate-200 text-slate-600 ring-1 ring-slate-300"],
};

export function Badge({ status }) {
  const [label, cls] = STATUS[status] || [status, "bg-slate-100 text-slate-700"];
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${cls}`}>
      {label}
    </span>
  );
}

export function PaymentBadge({ status }) {
  const [label, cls] = PAYMENT_STATUS[status] || [status || "-", "bg-slate-100 text-slate-700"];
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${cls}`}>
      {label}
    </span>
  );
}

export function Card({ title, children, className = "" }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
      {title && (
        <div className="mb-5 border-b border-slate-100 pb-3">
          <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
      <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-blue-50" />
      <div className="relative">
        <h2 className="text-sm font-semibold text-slate-500">{label}</h2>
        <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
        {sub && <p className="mt-1 text-xs font-medium text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

export function Shell({ session, title, nav, children }) {
  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-5 px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-lg font-black text-white shadow-sm">
              H
            </div>

            <div>
              <p className="text-base font-black leading-tight text-slate-900">
                Humanize Izzuleme
              </p>
              <p className="text-xs font-semibold text-blue-600">{title}</p>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-1">
            {nav.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
            <span className="hidden font-medium text-slate-500 sm:inline">
              {session.name}
            </span>

            <Link
              href="/account/password"
              className="rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              Password
            </Link>

            <form action={logoutAction}>
              <button className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-bold text-red-600 transition hover:bg-red-100">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {children}
      </main>
    </div>
  );
}

export function AuthPage({ title, subtitle, children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-transparent p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-2xl font-black text-white shadow-lg shadow-blue-200">
            H
          </div>
          <p className="text-sm font-bold text-blue-600">Humanize Izzuleme</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-200/50">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">{title}</h1>
          {subtitle && (
            <p className="mb-6 mt-1 text-sm leading-relaxed text-slate-500">
              {subtitle}
            </p>
          )}
          {children}
        </div>
      </div>
    </main>
  );
}

export function FileList({ files, empty = "No files." }) {
  if (!files?.length) {
    return <p className="text-sm text-slate-500">{empty}</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {files.map((f) => (
        <li key={f.id} className="flex items-center justify-between gap-3 py-3">
          <span className="truncate font-medium text-slate-700">
            {f.filename}
            {f.revision_no > 0 && (
              <em className="ml-2 text-xs font-medium text-slate-400">
                revision {f.revision_no}
              </em>
            )}
          </span>

          <a
            className="shrink-0 rounded-lg bg-blue-50 px-3 py-1.5 font-bold text-blue-700 transition hover:bg-blue-100"
            href={`/api/files/${f.id}`}
          >
            Download
          </a>
        </li>
      ))}
    </ul>
  );
}

export const Th = ({ children }) => (
  <th className="bg-slate-50 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
    {children}
  </th>
);

export const Td = ({ children, className = "" }) => (
  <td className={`px-4 py-3 text-sm font-medium text-slate-700 ${className}`}>
    {children}
  </td>
);

export const Table = ({ children }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200">
    <div className="overflow-x-auto">
      <table className="w-full text-sm [&_tbody_tr]:border-t [&_tbody_tr]:border-slate-100 [&_tbody_tr]:bg-white [&_tbody_tr]:transition [&_tbody_tr:hover]:bg-blue-50/40">
        {children}
      </table>
    </div>
  </div>
);