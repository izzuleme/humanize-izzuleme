"use client";
import ActionForm from "./ActionForm";
import { replaceReceiptAction } from "@/app/actions/customer";

export default function ReceiptForm({ orderId }) {
  return (
    <ActionForm action={replaceReceiptAction} fields={{ orderId }} label="Upload new receipt">
      <input name="receipt" type="file" accept=".pdf,.png,.jpg,.jpeg" required className="block w-full text-sm" />
    </ActionForm>
  );
}
