import { Resend } from "resend";

export async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey) {
    console.error("Email skipped: RESEND_API_KEY is missing.");
    return { ok: false, skipped: true };
  }

  if (!from) {
    console.error("Email skipped: EMAIL_FROM is missing.");
    return { ok: false, skipped: true };
  }

  if (!to) {
    console.error("Email skipped: recipient is missing.");
    return { ok: false, skipped: true };
  }

  try {
    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
    });

    if (error) {
      console.error("Resend email error:", error);
      return { ok: false, error };
    }

    return { ok: true, data };
  } catch (error) {
    console.error("Email send failed:", error);

    // Email failure must not break order/payment/delivery flow.
    return { ok: false, error };
  }
}