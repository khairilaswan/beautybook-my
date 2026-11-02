"use server";

import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/env";
import { normalizeMalaysianPhone } from "@/lib/phone";
import { localePath } from "@/lib/i18n/config";
import { getActionI18n } from "@/lib/i18n/server";
import { claimReferral } from "@/lib/referrals";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; step?: "code"; phone?: string; emailSent?: boolean };

// After sign-in, go back where the visitor was, or to their account page in
// the language they were using.
async function destination(next: string | null) {
  const { locale } = await getActionI18n();
  return safeNext(next, localePath(locale, "/account"));
}

export async function signInWithProvider(provider: "google" | "facebook", next: string) {
  const { locale, t } = await getActionI18n();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(await destination(next))}` },
  });
  if (error || !data.url) redirect(localePath(locale, `/login?error=${encodeURIComponent(t.login.errors.start)}`));
  redirect(data.url);
}

export async function sendPhoneCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const { t } = await getActionI18n();
  const phone = normalizeMalaysianPhone(String(form.get("phone") ?? ""));
  if (!phone) return { error: t.login.errors.mobile };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone: `+${phone}` });
  if (error) return { error: t.login.errors.sendCode };
  return { step: "code", phone };
}

export async function verifyPhoneCode(prev: LoginState, form: FormData): Promise<LoginState> {
  const { t } = await getActionI18n();
  const token = String(form.get("code") ?? "").trim();
  const phone = prev.phone;
  if (!phone || !/^[0-9]{6}$/.test(token)) return { ...prev, error: t.common.enterCode };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ phone: `+${phone}`, token, type: "sms" });
  if (error) return { ...prev, error: t.login.errors.badCode };
  if (data.user) await claimReferral(data.user.id, data.user.created_at);
  redirect(await destination(String(form.get("next") ?? "")));
}

export async function sendEmailLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const { t } = await getActionI18n();
  const email = String(form.get("email") ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: t.login.errors.email };
  const next = await destination(String(form.get("next") ?? ""));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { error: t.login.errors.sendEmail };
  return { emailSent: true };
}
