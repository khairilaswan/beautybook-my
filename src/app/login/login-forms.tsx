"use client";

import { useActionState } from "react";
import {
  type LoginState,
  sendEmailLink,
  sendPhoneCode,
  signInWithProvider,
  verifyPhoneCode,
} from "@/app/login/actions";

const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export function LoginForms({ next }: { next: string }) {
  const [phoneState, phoneAction, phonePending] = useActionState<LoginState, FormData>(
    async (prev, form) => (prev.step === "code" ? verifyPhoneCode(prev, form) : sendPhoneCode(prev, form)),
    {},
  );
  const [emailState, emailAction, emailPending] = useActionState<LoginState, FormData>(sendEmailLink, {});

  return (
    <div className="space-y-6">
      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => signInWithProvider("google", next)}
          className="rounded-xl border border-line bg-white px-4 py-3 font-medium hover:border-ink"
        >
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => signInWithProvider("facebook", next)}
          className="rounded-xl border border-line bg-white px-4 py-3 font-medium hover:border-ink"
        >
          Continue with Facebook
        </button>
      </div>

      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <form action={phoneAction} className="space-y-2">
        <input type="hidden" name="next" value={next} />
        {phoneState.step === "code" ? (
          <label className="block text-sm">
            <span className="font-medium">Code sent to +{phoneState.phone}</span>
            <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className={input} />
          </label>
        ) : (
          <label className="block text-sm">
            <span className="font-medium">Mobile number</span>
            <input name="phone" type="tel" placeholder="012-345 6789" autoComplete="tel" required className={input} />
          </label>
        )}
        {phoneState.error && <p role="alert" className="text-sm text-brand-700">{phoneState.error}</p>}
        <button disabled={phonePending} className="w-full rounded-xl bg-ink px-4 py-3 font-medium text-white disabled:opacity-60">
          {phoneState.step === "code" ? "Sign in" : "Send code"}
        </button>
      </form>

      <form action={emailAction} className="space-y-2">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm">
          <span className="font-medium">Or get a sign-in link by email</span>
          <input name="email" type="email" autoComplete="email" required className={input} />
        </label>
        {emailState.error && <p role="alert" className="text-sm text-brand-700">{emailState.error}</p>}
        {emailState.emailSent ? (
          <p className="text-sm text-whatsapp">Check your inbox for the sign-in link.</p>
        ) : (
          <button disabled={emailPending} className="w-full rounded-xl border border-line bg-white px-4 py-3 font-medium disabled:opacity-60">
            Email me a link
          </button>
        )}
      </form>
    </div>
  );
}
