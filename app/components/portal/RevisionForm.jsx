"use client";
import ActionForm, { input } from "./ActionForm";
import { requestRevisionAction } from "@/app/actions/customer";

export default function RevisionForm({ orderId }) {
  return (
    <ActionForm action={requestRevisionAction} fields={{ orderId }} label="Request revision">
      <textarea name="note" rows={3} required placeholder="What needs to change?" className={input} />
      <input name="files" type="file" multiple className="block w-full text-sm" />
    </ActionForm>
  );
}
