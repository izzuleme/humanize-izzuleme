"use client";
import ActionForm, { input } from "./ActionForm";
import SettingsFields from "./SettingsFields";
import {
  deliverAction,
  startOrderAction,
  setAvailabilityAction,
  updateMySettingsAction,
  updateOrderMinutesAction,
} from "@/app/actions/worker";

export function DeliverForm({ orderId, revision }) {
  return (
    <ActionForm action={deliverAction} fields={{ orderId }} label={revision ? "Upload revised documents" : "Upload completed documents"}>
      <input name="files" type="file" multiple required className="block w-full text-sm" />
    </ActionForm>
  );
}
export function StartButton({ orderId }) {
  return <ActionForm action={startOrderAction} fields={{ orderId }} label="Start working" tone="ghost" inline />;
}
export function AvailabilityToggle({ available }) {
  return (
    <ActionForm action={setAvailabilityAction} fields={{ available: String(!available) }} inline
      label={available ? "Set Unavailable" : "Set Available"} tone={available ? "ghost" : "dark"} />
  );
}
export function MySettingsForm({ w }) {
  return (
    <ActionForm action={updateMySettingsAction} label="Save settings">
      <SettingsFields w={w} />
    </ActionForm>
  );
}

export function EstimatedTimeForm({ orderId, minutes }) {
  return (
    <ActionForm
      key={`${orderId}-${minutes}`}
      action={updateOrderMinutesAction}
      fields={{ orderId }}
      label="Update estimated time"
    >
      <div>
        <label className="mb-1 block text-sm font-bold">
          Estimated completion time
        </label>

        <div className="flex items-center gap-2">
          <input
            name="minutes"
            type="number"
            min="5"
            max="1440"
            step="5"
            defaultValue={minutes ?? 30}
            required
            className={input}
          />

          <span className="text-sm text-slate-500">
            minutes
          </span>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Set how many minutes you expect to need for this order.
          The system will prevent overlapping orders.
        </p>
      </div>
    </ActionForm>
  );
}