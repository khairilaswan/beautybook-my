"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n/config";
import { getActionI18n, localizedPath } from "@/lib/i18n/server";
import { listingPath } from "@/lib/paths";
import { startCheckout } from "@/lib/payments";
import { paymentsEnabled } from "@/lib/setup";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  listingId: z.uuid(),
  amount: z.coerce.number().int(),
  buyerName: z.string().trim().min(1, "buyerName").max(80),
  recipientName: z.string().trim().min(1, "recipientName").max(80),
  message: z.string().trim().max(300).optional(),
});

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function voucherCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

export type GiftState = { error?: string };

export async function buyVoucher(_prev: GiftState, form: FormData): Promise<GiftState> {
  const { t } = await getActionI18n();
  const g = t.growth.gift;
  if (!paymentsEnabled()) return { error: g.notOnSale };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    return { error: issue === "buyerName" ? t.booking.errors.name : issue === "recipientName" ? g.whoFor : t.booking.errors.checkForm };
  }
  const input = parsed.data;
  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id, slug, name, status, voucher_settings ( enabled, amounts, valid_months )")
    .eq("id", input.listingId)
    .maybeSingle();
  const settings = (listing as unknown as { voucher_settings: { enabled: boolean; amounts: number[]; valid_months: number } | null } | null)
    ?.voucher_settings;
  if (!listing || listing.status !== "active" || !settings?.enabled) return { error: g.notSelling };
  if (!settings.amounts.includes(input.amount)) return { error: g.pickAmount };
  const user = await requireUser(`${listingPath(listing.slug)}/gift`);

  const expires = new Date();
  expires.setMonth(expires.getMonth() + settings.valid_months);
  const { data: voucher, error } = await admin
    .from("gift_vouchers")
    .insert({
      code: voucherCode(),
      listing_id: listing.id,
      amount_rm: input.amount,
      buyer_id: user.id,
      buyer_name: input.buyerName,
      recipient_name: input.recipientName,
      message: input.message || null,
      expires_at: expires.toISOString(),
    })
    .select("id")
    .single();
  if (error) return { error: t.common.tryAgain };
  const url = await startCheckout({
    kind: "voucher",
    refId: voucher.id,
    userId: user.id,
    amountRm: input.amount,
    description: fmt(g.checkoutLine, { amount: `RM${input.amount}`, shop: listing.name }),
    successPath: await localizedPath(`/account/vouchers/${voucher.id}`),
    cancelPath: await localizedPath(`${listingPath(listing.slug)}/gift`),
    email: user.email,
  });
  redirect(url);
}
