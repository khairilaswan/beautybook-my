"use client";

import { useActionState } from "react";
import { submitReport, type ReportState } from "@/app/[lang]/salon/[slug]/report/actions";
import { Turnstile } from "@/components/turnstile";
import { useI18n } from "@/lib/i18n/client";

const REASONS = ["closed", "wrong_phone", "wrong_info", "removal_request", "other"] as const;

const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export function ReportForm({ listingId }: { listingId: string }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(submitReport, {});
  const { t } = useI18n();
  if (state.done) return <p className="rounded-xl bg-green-50 p-4">{t.report.thanks}</p>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="listingId" value={listingId} />
      <fieldset className="space-y-2 text-sm">
        <legend className="font-medium">{t.report.question}</legend>
        {REASONS.map((value) => (
          <label key={value} className="flex items-center gap-2">
            <input type="radio" name="reason" value={value} required /> {t.report.reasons[value]}
          </label>
        ))}
      </fieldset>
      <label className="block text-sm">
        <span className="font-medium">{t.report.details}</span>
        <textarea name="details" rows={4} maxLength={2000} className={input} />
      </label>
      <label className="block text-sm">
        <span className="font-medium">{t.report.contact}</span>
        <input name="contact" maxLength={200} placeholder={t.report.contactPlaceholder} className={input} />
      </label>
      <Turnstile />
      {state.error && <p role="alert" className="text-sm text-brand-700">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-ink px-4 py-3 font-medium text-white disabled:opacity-60">
        {t.report.send}
      </button>
    </form>
  );
}
