"use server";

import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/env";
import { normalizeMalaysianPhone } from "@/lib/phone";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; step?: "code"; phone?: string; emailSent?: boolean };

export async function signInWithProvider(provider: "google" | "facebook", next: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(safeNext(next))}` },
  });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent("Could not start sign-in. Please try again.")}`);
  redirect(data.url);
}

export async function sendPhoneCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const phone = normalizeMalaysianPhone(String(form.get("phone") ?? ""));
  if (!phone) return { error: "Please enter a Malaysian mobile number." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone: `+${phone}` });
  if (error) return { error: "Could not send a code. Please try again in a minute." };
  return { step: "code", phone };
}

export async function verifyPhoneCode(prev: LoginState, form: FormData): Promise<LoginState> {
  const token = String(form.get("code") ?? "").trim();
  const phone = prev.phone;
  if (!phone || !/^[0-9]{6}$/.test(token)) return { ...prev, error: "Enter the 6-digit code." };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ phone: `+${phone}`, token, type: "sms" });
  if (error) return { ...prev, error: "That code didn't work. Check it or ask for a new one." };
  redirect(safeNext(String(form.get("next") ?? "")));
}

export async function sendEmailLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Please enter a valid email." };
  const next = safeNext(String(form.get("next") ?? ""));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { error: "Could not send the email. Please try again in a minute." };
  return { emailSent: true };
}
