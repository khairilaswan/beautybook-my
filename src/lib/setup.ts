import "server-only";

// Features that need an outside account stay hidden until their keys are set,
// the same way login and claim options only show once they work.

// Card and FPX payments through Stripe Checkout (featured placement, gift vouchers).
export function paymentsEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
}

// Appointment reminders and "time for a touch-up" messages. Either channel works.
export function whatsAppRemindersEnabled(): boolean {
  return (
    !!process.env.WHATSAPP_ACCESS_TOKEN &&
    !!process.env.WHATSAPP_PHONE_NUMBER_ID &&
    !!process.env.WHATSAPP_REMINDER_TEMPLATE
  );
}

export function emailRemindersEnabled(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.REMINDER_FROM_EMAIL;
}

export function remindersEnabled(): boolean {
  return whatsAppRemindersEnabled() || emailRemindersEnabled();
}

export type SetupStatus = { name: string; ready: boolean; needs: string };

// Shown in /admin/features so the owner can see what is still to set up.
export function setupStatus(): SetupStatus[] {
  return [
    {
      name: "Payments (featured placement, gift vouchers)",
      ready: paymentsEnabled(),
      needs: "STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (webhook URL: /api/payments/webhook)",
    },
    {
      name: "WhatsApp reminders",
      ready: whatsAppRemindersEnabled(),
      needs: "WHATSAPP_REMINDER_TEMPLATE (plus the WhatsApp Cloud API keys used for claims)",
    },
    {
      name: "Email reminders",
      ready: emailRemindersEnabled(),
      needs: "RESEND_API_KEY and REMINDER_FROM_EMAIL",
    },
    {
      name: "Reminder schedule",
      ready: !!process.env.CRON_SECRET,
      needs: "CRON_SECRET (Vercel sends it to /api/cron/reminders every hour)",
    },
  ];
}
