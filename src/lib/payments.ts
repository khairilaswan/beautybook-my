import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { siteUrl } from "@/lib/env";
import { paymentsEnabled } from "@/lib/setup";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe Checkout (cards and FPX online banking in MYR), called over its REST
// API so there is no SDK to keep up to date. Only used once STRIPE_SECRET_KEY
// and STRIPE_WEBHOOK_SECRET are set; see lib/setup.ts.

type CheckoutInput = {
  kind: "featured" | "voucher";
  refId: string;
  userId: string | null;
  amountRm: number;
  description: string;
  successPath: string;
  cancelPath: string;
  email?: string | null;
};

export async function startCheckout(input: CheckoutInput): Promise<string> {
  if (!paymentsEnabled()) throw new Error("Payments are not set up");
  const admin = createAdminClient();
  const amountSen = Math.round(input.amountRm * 100);
  const { data: payment, error } = await admin
    .from("payments")
    .insert({ kind: input.kind, ref_id: input.refId, user_id: input.userId, amount_sen: amountSen })
    .select("id")
    .single();
  if (error) throw error;

  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "myr",
    "line_items[0][price_data][unit_amount]": String(amountSen),
    "line_items[0][price_data][product_data][name]": input.description.slice(0, 120),
    client_reference_id: payment.id,
    "metadata[payment_id]": payment.id,
    success_url: `${siteUrl}${input.successPath}`,
    cancel_url: `${siteUrl}${input.cancelPath}`,
  });
  if (input.email) form.set("customer_email", input.email);
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": payment.id,
    },
    body: form,
  });
  const session = (await res.json()) as { id?: string; url?: string; error?: { message: string } };
  if (!res.ok || !session.url || !session.id) {
    await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
    throw new Error(`Stripe checkout failed: ${session.error?.message ?? res.status}`);
  }
  await admin.from("payments").update({ provider_ref: session.id }).eq("id", payment.id);
  return session.url;
}

// Checks the Stripe-Signature header (HMAC-SHA256 over "timestamp.body").
export function verifyStripeSignature(rawBody: string, header: string | null, toleranceSec = 300): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i), p.slice(i + 1)];
    }),
  ) as Record<string, string>;
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest();
  const signatures = header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => Buffer.from(p.slice(3), "hex"));
  return signatures.some((sig) => sig.length === expected.length && timingSafeEqual(sig, expected));
}

// Marks a payment paid and turns on what was bought. Safe to run twice.
export async function fulfilPayment(paymentId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("kind, ref_id")
    .maybeSingle();
  if (!payment) return;
  if (payment.kind === "featured") {
    const { data: placement } = await admin
      .from("featured_placements")
      .select("ends_at, starts_at")
      .eq("id", Number(payment.ref_id))
      .single();
    const days = placement
      ? Math.round((new Date(placement.ends_at).getTime() - new Date(placement.starts_at).getTime()) / 86_400_000)
      : 30;
    const now = Date.now();
    await admin
      .from("featured_placements")
      .update({
        status: "active",
        starts_at: new Date(now).toISOString(),
        ends_at: new Date(now + days * 86_400_000).toISOString(),
      })
      .eq("id", Number(payment.ref_id));
  } else if (payment.kind === "voucher") {
    await admin.from("gift_vouchers").update({ status: "active" }).eq("id", payment.ref_id).eq("status", "pending_payment");
  }
}
