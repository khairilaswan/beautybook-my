import "server-only";
import { emailRemindersEnabled, whatsAppRemindersEnabled } from "@/lib/setup";

export type ReminderMessage = {
  phone: string | null;
  email: string | null;
  subject: string;
  // Template parameters for WhatsApp, in order: name, shop, detail, link.
  params: [string, string, string, string];
  text: string;
  // How to stop these messages, in the customer's language (email only).
  footer: string;
};

// Sends by WhatsApp (an approved utility template) when possible, otherwise
// by email. Returns false when neither channel could deliver.
export async function sendReminder(m: ReminderMessage): Promise<boolean> {
  if (whatsAppRemindersEnabled() && m.phone) {
    const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: m.phone,
        type: "template",
        template: {
          name: process.env.WHATSAPP_REMINDER_TEMPLATE,
          language: { code: process.env.WHATSAPP_REMINDER_LANGUAGE ?? "en" },
          components: [{ type: "body", parameters: m.params.map((text) => ({ type: "text", text })) }],
        },
      }),
    });
    if (res.ok) return true;
    console.error("WhatsApp reminder failed", res.status, await res.text());
  }
  if (emailRemindersEnabled() && m.email) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.REMINDER_FROM_EMAIL,
        to: m.email,
        subject: m.subject,
        text: `${m.text}\n\n${m.footer}`,
      }),
    });
    if (res.ok) return true;
    console.error("Email reminder failed", res.status, await res.text());
  }
  return false;
}
