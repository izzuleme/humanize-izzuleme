"use client";
import ActionForm, { input } from "./ActionForm";
import SettingsFields from "./SettingsFields";
import { deliverAction, startOrderAction, setAvailabilityAction, updateMySettingsAction } from "@/app/actions/worker";

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
