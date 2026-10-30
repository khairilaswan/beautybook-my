import "server-only";

// Sends a one-time code with the WhatsApp Cloud API, using an approved
// authentication template. This is the only message BeautyBook sends itself;
// we never message shops that did not ask for a code.
export async function sendWhatsAppCode(to: string, code: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_OTP_TEMPLATE ?? "claim_code";

  if (!token || !phoneNumberId) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("WhatsApp Cloud API is not configured");
    }
    console.info(`[dev] WhatsApp code for +${to}: ${code}`);
    return;
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template,
        language: { code: "en" },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ],
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`WhatsApp send failed: ${res.status} ${await res.text()}`);
  }
}
