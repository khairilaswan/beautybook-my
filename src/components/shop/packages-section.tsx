"use client";

import { useActionState, useEffect, useState } from "react";
import { requestQuote, type QuoteState } from "@/app/[lang]/salon/[slug]/quote-actions";
import { Turnstile } from "@/components/turnstile";
import { priceRangeLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { EVENT_TYPES } from "@/lib/labels";
import type { ServicePackage } from "@/lib/types";

const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export function PackagesSection({
  listingId,
  packages,
  canRequest,
}: {
  listingId: string;
  packages: ServicePackage[];
  canRequest: boolean;
}) {
  const { locale, t } = useI18n();
  const g = t.growth.quote;
  const [picked, setPicked] = useState<number | "" | null>(null);
  return (
    <div className="mt-3 space-y-3">
      <ul className="grid gap-3 sm:grid-cols-2">
        {packages.map((p) => {
          const price = priceRangeLabel(p.price_from, p.price_to, locale);
          return (
            <li key={p.id} className="flex flex-col rounded-2xl border border-line bg-white p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t.growth.packageKinds[p.kind]}</p>
              <p className="mt-1 text-base font-semibold">{p.name}</p>
              {price && <p className="font-medium">{price}</p>}
              {p.description && <p className="mt-1 whitespace-pre-line">{p.description}</p>}
              {p.includes.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-muted">
                  {p.includes.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
              {canRequest && (
                <button
                  type="button"
                  onClick={() => setPicked(p.id)}
                  className="mt-3 self-start rounded-full bg-ink px-3 py-1 text-white"
                >
                  {g.request}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {canRequest && picked === null && (
        <button type="button" onClick={() => setPicked("")} className="text-sm underline">
          {g.custom}
        </button>
      )}
      {canRequest && picked !== null && (
        <QuoteForm listingId={listingId} packages={packages} packageId={picked} onClose={() => setPicked(null)} />
      )}
    </div>
  );
}

function QuoteForm({
  listingId,
  packages,
  packageId,
  onClose,
}: {
  listingId: string;
  packages: ServicePackage[];
  packageId: number | "";
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<QuoteState, FormData>(requestQuote, {});
  const { t } = useI18n();
  const g = t.growth.quote;
  useEffect(() => {
    if (state.whatsappUrl) window.location.href = state.whatsappUrl;
  }, [state.whatsappUrl]);
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-white p-4 text-sm" id="quote">
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold">{g.request}</p>
        <button type="button" onClick={onClose} className="text-muted underline">{t.growth.common.close}</button>
      </div>
      <input type="hidden" name="listingId" value={listingId} />
      <label className="block">
        <span className="font-medium">{g.package}</span>
        <select name="packageId" defaultValue={packageId} key={packageId} className={input}>
          <option value="">{g.notSure}</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="font-medium">{g.occasion}</span>
          <select name="eventType" required className={input}>
            {EVENT_TYPES.map((e) => (
              <option key={e} value={e}>{t.growth.eventTypes[e]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-medium">{g.date}</span>
          <input name="eventDate" type="date" className={input} />
        </label>
        <label className="block">
          <span className="font-medium">{g.people}</span>
          <input name="people" type="number" min={1} max={500} placeholder={g.peoplePlaceholder} className={input} />
        </label>
        <label className="block">
          <span className="font-medium">{g.budget}</span>
          <input name="budget" maxLength={40} placeholder={g.budgetPlaceholder} className={input} />
        </label>
      </div>
      <label className="block">
        <span className="font-medium">{g.where}</span>
        <input name="location" maxLength={200} placeholder={g.wherePlaceholder} className={input} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="font-medium">{t.booking.yourName}</span>
          <input name="name" required maxLength={80} autoComplete="name" className={input} />
        </label>
        <label className="block">
          <span className="font-medium">{t.growth.booking.phone}</span>
          <input name="phone" required type="tel" maxLength={20} autoComplete="tel" className={input} />
        </label>
      </div>
      <label className="block">
        <span className="font-medium">{g.anythingElse}</span>
        <textarea name="note" maxLength={500} rows={2} className={input} />
      </label>
      <Turnstile />
      {state.error && <p role="alert" className="text-brand-700">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-whatsapp px-4 py-3 font-semibold text-white disabled:opacity-60">
        {pending ? t.booking.opening : g.send}
      </button>
    </form>
  );
}
