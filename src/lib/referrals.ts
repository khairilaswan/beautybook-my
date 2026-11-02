import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const REFERRAL_COOKIE = "bb_ref";
const NEW_ACCOUNT_MS = 24 * 3_600_000;

// After a sign-in: if the visitor arrived through a friend's invite link and
// this is a brand-new account, remember who invited them. Points are paid
// when the new member's first booking is completed (database trigger).
export async function claimReferral(userId: string, createdAt: string | undefined): Promise<void> {
  const jar = await cookies();
  const code = jar.get(REFERRAL_COOKIE)?.value?.toUpperCase();
  if (!code) return;
  jar.delete(REFERRAL_COOKIE);
  if (!/^[0-9A-F]{8}$/.test(code)) return;
  if (!createdAt || Date.now() - new Date(createdAt).getTime() > NEW_ACCOUNT_MS) return;
  const admin = createAdminClient();
  const { data: referrer } = await admin.from("profiles").select("id").eq("referral_code", code).maybeSingle();
  if (!referrer || referrer.id === userId) return;
  const { error } = await admin.from("referrals").insert({ referred_id: userId, referrer_id: referrer.id });
  if (error && error.code !== "23505") console.error("referral insert failed", error.message);
}
