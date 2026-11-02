"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/app/[lang]/admin/actions";
import { saveFeatureSettings } from "@/app/[lang]/admin/growth-actions";
import type { FeatureSettings } from "@/lib/data/features";

const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export function FeatureForm({ initial }: { initial: FeatureSettings }) {
  const [s, setS] = useState(initial);
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4 rounded-2xl border border-line bg-white p-5 text-sm">
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1" checked={s.reviewsEnabled} onChange={(e) => setS({ ...s, reviewsEnabled: e.target.checked })} />
        <span>
          <span className="font-medium">Ratings and reviews</span>
          <span className="block text-muted">
            Customers can review a visit once the shop marks their booking completed. Stars show on shop pages, cards
            and in Google results. Off by default.
          </span>
        </span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="font-medium">Referral points</span>
          <input type="number" min={0} max={10000} value={s.referralPoints} onChange={(e) => setS({ ...s, referralPoints: Number(e.target.value) })} className={input} />
          <span className="text-xs text-muted">For the inviter; the new member gets half.</span>
        </label>
        <label className="block">
          <span className="font-medium">Featured placement price (RM, 30 days)</span>
          <input type="number" min={1} max={100000} value={s.featuredPriceRm} onChange={(e) => setS({ ...s, featuredPriceRm: Number(e.target.value) })} className={input} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded-full bg-ink px-4 py-2 font-medium text-white disabled:opacity-60"
          onClick={() =>
            start(async () =>
              setState(
                await saveFeatureSettings({
                  reviews_enabled: s.reviewsEnabled,
                  referral_points: s.referralPoints,
                  featured_price_rm: s.featuredPriceRm,
                }),
              ),
            )
          }
        >
          Save
        </button>
        {state.error && <span role="alert" className="text-brand-700">{state.error}</span>}
        {state.message && <span className="text-whatsapp">{state.message}</span>}
      </div>
    </div>
  );
}
