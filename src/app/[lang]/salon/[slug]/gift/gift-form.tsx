"use client";

import { useActionState } from "react";
import { buyVoucher, type GiftState } from "@/app/[lang]/salon/[slug]/gift/actions";
import { useI18n } from "@/lib/i18n/client";

const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export function GiftForm({ listingId, amounts, buyerName }: { listingId: string; amounts: number[]; buyerName: string }) {
  const [state, action, pending] = useActionState<GiftState, FormData>(buyVoucher, {});
  const { t } = useI18n();
  const g = t.growth.gift;
  return (
    <form action={action} className="mt-6 space-y-4 rounded-2xl border border-line bg-white p-5 text-sm">
      <input type="hidden" name="listingId" value={listingId} />
      <fieldset>
        <legend className="font-medium">{g.amount}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {amounts.map((a, i) => (
            <label key={a} className="flex items-center gap-2 rounded-full border border-line px-4 py-2 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
              <input type="radio" name="amount" value={a} defaultChecked={i === 0} className="sr-only" />
              RM{a}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="font-medium">{g.for}</span>
        <input name="recipientName" required maxLength={80} placeholder={g.theirName} className={input} />
      </label>
      <label className="block">
        <span className="font-medium">{g.from}</span>
        <input name="buyerName" required maxLength={80} defaultValue={buyerName} className={input} />
      </label>
      <label className="block">
        <span className="font-medium">{g.message}</span>
        <textarea name="message" maxLength={300} rows={2} placeholder={g.messagePlaceholder} className={input} />
      </label>
      {state.error && <p role="alert" className="text-brand-700">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white disabled:opacity-60">
        {pending ? g.opening : g.pay}
      </button>
    </form>
  );
}
