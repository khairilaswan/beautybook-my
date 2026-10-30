"use client";

import { useActionState } from "react";
import { addBusiness, verifyClaim, type ClaimState } from "@/app/claim/actions";
import { Turnstile } from "@/components/turnstile";

type State = ClaimState & { listingId?: string; slug?: string };
const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export function AddBusinessForm(props: { categories: { slug: string; name: string }[]; areas: { slug: string; name: string }[] }) {
  const [state, action, pending] = useActionState<State, FormData>(
    async (prev, form) => (prev.claimId ? { ...prev, ...(await verifyClaim(prev, form)) } : addBusiness(prev, form)),
    {},
  );

  if (state.claimId) {
    return (
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="slug" value={state.slug} />
        <p className="text-sm">We sent a 6-digit code to {state.sentTo} on WhatsApp.</p>
        <label className="block text-sm">
          <span className="font-medium">Code</span>
          <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className={input} />
        </label>
        {state.error && <p role="alert" className="text-sm text-brand-700">{state.error}</p>}
        <button disabled={pending} className="w-full rounded-xl bg-ink px-4 py-3 font-medium text-white disabled:opacity-60">
          Verify and publish
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="mt-4 space-y-3">
      <label className="block text-sm">
        <span className="font-medium">Business name</span>
        <input name="name" required maxLength={120} className={input} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Main service</span>
          <select name="category" required className={input}>
            <option value="">Choose…</option>
            {props.categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Area</span>
          <select name="area" required className={input}>
            <option value="">Choose…</option>
            {props.areas.map((a) => (
              <option key={a.slug} value={a.slug}>{a.name}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium">WhatsApp number</span>
        <input name="phone" type="tel" required placeholder="012-345 6789" className={input} />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Address (optional)</span>
        <input name="address" maxLength={300} className={input} />
      </label>
      <Turnstile />
      {state.error && <p role="alert" className="text-sm text-brand-700">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-whatsapp px-4 py-3 font-semibold text-white disabled:opacity-60">
        {pending ? "Sending code…" : "Add and send WhatsApp code"}
      </button>
      <p className="text-xs text-muted">You&apos;ll be asked to sign in first if you aren&apos;t already.</p>
    </form>
  );
}
