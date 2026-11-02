"use client";

import { useActionState } from "react";
import { addBusiness, verifyClaim, type ClaimState } from "@/app/[lang]/claim/actions";
import { Turnstile } from "@/components/turnstile";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";

type State = ClaimState & { listingId?: string; slug?: string };
const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export function AddBusinessForm(props: {
  categories: { slug: string; name: string }[];
  areas: { slug: string; name: string }[];
  byCode: boolean;
}) {
  const [state, action, pending] = useActionState<State, FormData>(
    async (prev, form) => (prev.claimId ? { ...prev, ...(await verifyClaim(prev, form)) } : addBusiness(prev, form)),
    {},
  );
  const { t } = useI18n();
  const a = t.addBusiness;

  if (state.claimId) {
    return (
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="slug" value={state.slug} />
        <p className="text-sm">{fmt(a.codeSent, { to: state.sentTo ?? "" })}</p>
        <label className="block text-sm">
          <span className="font-medium">{a.code}</span>
          <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className={input} />
        </label>
        {state.error && <p role="alert" className="text-sm text-brand-700">{state.error}</p>}
        <button disabled={pending} className="w-full rounded-xl bg-ink px-4 py-3 font-medium text-white disabled:opacity-60">
          {a.verify}
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="mt-4 space-y-3">
      <label className="block text-sm">
        <span className="font-medium">{a.name}</span>
        <input name="name" required maxLength={120} className={input} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">{a.mainService}</span>
          <select name="category" required className={input}>
            <option value="">{t.common.choose}</option>
            {props.categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">{t.common.area}</span>
          <select name="area" required className={input}>
            <option value="">{t.common.choose}</option>
            {props.areas.map((area) => (
              <option key={area.slug} value={area.slug}>{area.name}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium">{a.whatsapp}</span>
        <input name="phone" type="tel" required placeholder="012-345 6789" className={input} />
      </label>
      <label className="block text-sm">
        <span className="font-medium">{a.address}</span>
        <input name="address" maxLength={300} className={input} />
      </label>
      <Turnstile />
      {state.error && <p role="alert" className="text-sm text-brand-700">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-whatsapp px-4 py-3 font-semibold text-white disabled:opacity-60">
        {props.byCode ? (pending ? a.sendingCode : a.addAndSend) : pending ? a.adding : a.add}
      </button>
      <p className="text-xs text-muted">{a.signInFirst}</p>
    </form>
  );
}
