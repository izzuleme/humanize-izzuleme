"use client";
import ActionForm, { input } from "./ActionForm";
import SettingsFields from "./SettingsFields";
import {
  createWorkerAction, setWorkerStatusAction, resetWorkerPasswordAction, adminUpdateWorkerAction,
  approveOrderAction, assignOrderAction, autoReassignAction, cancelOrderAction, markPaidAction,
} from "@/app/actions/admin";

export function CreateWorkerForm() {
  return (
    <ActionForm action={createWorkerAction} label="Create worker">
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="username" placeholder="Username" required className={input} autoComplete="off" />
<input name="display_name" placeholder="Display name" className={input} />
<input name="email" type="email" placeholder="Worker email" required className={input} autoComplete="off" />
<input name="phone" placeholder="WhatsApp number, e.g. 60123456789" required className={input} />
<input name="password" placeholder="Temporary password (blank = generate)" className={input} autoComplete="off" />
      </div>
      <SettingsFields withRate />
    </ActionForm>
  );
}
export function WorkerEditForm({ accountId, displayName, w }) {
  return (
    <ActionForm action={adminUpdateWorkerAction} fields={{ accountId }} label="Save worker">
      <label className="block text-sm font-medium text-slate-700">Display name
        <input name="display_name" defaultValue={displayName} className={input + " mt-1"} /></label>
        <label className="block text-sm font-medium text-slate-700">Email
  <input
    name="email"
    type="email"
    defaultValue={w.email || ""}
    placeholder="worker@example.com"
    className={input + " mt-1"}
  />
</label>
      <label className="block text-sm font-medium text-slate-700">Availability
        <select name="is_available" defaultValue={String(w.is_available)} className={input + " mt-1"}>
          <option value="true">Available</option><option value="false">Unavailable</option></select></label>
      <SettingsFields w={w} withRate />
    </ActionForm>
  );
}
export function StatusButtons({ accountId, status }) {
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "active" && <ActionForm action={setWorkerStatusAction} fields={{ accountId, status: "active" }} label="Activate" inline />}
      {status !== "inactive" && <ActionForm action={setWorkerStatusAction} fields={{ accountId, status: "inactive" }} label="Deactivate" tone="ghost" inline confirm="Deactivate this worker? They will be signed out." />}
      {status !== "suspended" && <ActionForm action={setWorkerStatusAction} fields={{ accountId, status: "suspended" }} label="Suspend" tone="danger" inline confirm="Suspend this worker? They will be signed out." />}
    </div>
  );
}
export const ResetPasswordButton = ({ accountId }) =>
  <ActionForm action={resetWorkerPasswordAction} fields={{ accountId }} label="Reset password" tone="ghost" inline confirm="Reset this worker's password?" />;
export const ApproveButton = ({ orderId }) =>
  <ActionForm action={approveOrderAction} fields={{ orderId }} label="Approve & record payroll" inline confirm="Approve this order and add it to the worker's payroll?" />;
export const ReassignButton = ({ orderId }) =>
  <ActionForm action={autoReassignAction} fields={{ orderId }} label="Auto-reassign" tone="ghost" inline confirm="Move this order to another eligible worker?" />;
export const CancelButton = ({ orderId }) =>
  <ActionForm action={cancelOrderAction} fields={{ orderId }} label="Cancel order" tone="danger" inline confirm="Cancel this order?" />;
export const MarkPaidButton = ({ entryId, workerId, label = "Mark paid" }) =>
  <ActionForm action={markPaidAction} fields={entryId ? { entryId } : { workerId }} label={label} tone="ghost" inline confirm="Mark as paid?" />;
export function AssignForm({ orderId, workers }) {
  return (
    <ActionForm action={assignOrderAction} fields={{ orderId }} label="Assign" inline>
      <select name="workerId" required className={input + " mb-2"}>
        <option value="">Choose worker…</option>
        {workers.map((w) => <option key={w.worker_id} value={w.worker_id}>{w.name}</option>)}
      </select>
    </ActionForm>
  );
}

import { startReviewAction, approvePaymentAction, rejectPaymentAction, requestReceiptAction, savePaymentSettingsAction } from "@/app/actions/payments";

export const StartReviewButton = ({ orderId }) =>
  <ActionForm action={startReviewAction} fields={{ orderId }} label="Start verification" tone="ghost" inline />;
export function ApprovePaymentForm({ orderId }) {
  return (
    <ActionForm action={approvePaymentAction} fields={{ orderId }} label="Approve payment" confirm="Confirm the money has actually arrived in the account. Approve payment?">
      <input name="note" placeholder="Internal note (optional)" className={input} />
    </ActionForm>
  );
}
export function RejectPaymentForm({ orderId }) {
  return (
    <ActionForm action={rejectPaymentAction} fields={{ orderId }} label="Reject payment" tone="danger" confirm="Reject this payment?">
      <textarea name="internal_note" required rows={2} placeholder="Internal note (required, admin only)" className={input} />
      <textarea name="customer_message" rows={2} placeholder="Message shown to the customer (optional)" className={input} />
    </ActionForm>
  );
}
export function RequestReceiptForm({ orderId }) {
  return (
    <ActionForm action={requestReceiptAction} fields={{ orderId }} label="Request another receipt" tone="ghost">
      <textarea name="internal_note" rows={2} placeholder="Internal note (optional)" className={input} />
      <textarea name="customer_message" rows={2} placeholder="What the customer should send (optional)" className={input} />
    </ActionForm>
  );
}
export function PaymentSettingsForm({ s }) {
  const f = (name, label, props = {}) => (
    <label className="block text-sm font-medium text-slate-700">{label}
      <input name={name} defaultValue={s[name] ?? ""} className={input + " mt-1"} {...props} /></label>
  );
  return (
    <ActionForm action={savePaymentSettingsAction} label="Save settings">
      {f("whatsapp_number", "WhatsApp business number (with country code)", { required: true, placeholder: "60123456789" })}
      <div className="grid gap-3 sm:grid-cols-2">
        {f("bank_name", "Bank name")}{f("account_holder", "Account holder name")}
        {f("account_number", "Account number")}{f("payment_methods", "Supported payment methods", { placeholder: "Bank transfer, Touch 'n Go eWallet, DuitNow QR" })}
        {f("price_standard", "Price per page, Standard (RM)", { type: "number", step: "0.01", min: 0, required: true })}
        {f("price_academic", "Price per page, Academic (RM)", { type: "number", step: "0.01", min: 0, required: true })}
      </div>
      <label className="block text-sm font-medium text-slate-700">Payment instructions
        <textarea name="instructions" defaultValue={s.instructions ?? ""} rows={4} className={input + " mt-1"} /></label>
    </ActionForm>
  );
}
