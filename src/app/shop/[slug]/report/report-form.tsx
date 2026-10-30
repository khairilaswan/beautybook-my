"use client";

import { useActionState } from "react";
import { submitReport, type ReportState } from "@/app/shop/[slug]/report/actions";
import { Turnstile } from "@/components/turnstile";

const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export function ReportForm({ listingId }: { listingId: string }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(submitReport, {});
  if (state.done) return <p className="rounded-xl bg-green-50 p-4">Thanks, we&apos;ve got it. We usually check reports within a few days.</p>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="listingId" value={listingId} />
      <fieldset className="space-y-2 text-sm">
        <legend className="font-medium">What&apos;s the problem?</legend>
        {[
          ["closed", "The shop has closed"],
          ["wrong_phone", "Wrong phone number"],
          ["wrong_info", "Other details are wrong"],
          ["removal_request", "Remove this listing (I'm the owner)"],
          ["other", "Something else"],
        ].map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input type="radio" name="reason" value={value} required /> {label}
          </label>
        ))}
      </fieldset>
      <label className="block text-sm">
        <span className="font-medium">Details</span>
        <textarea name="details" rows={4} maxLength={2000} className={input} />
      </label>
      <label className="block text-sm">
        <span className="font-medium">How can we reach you? (optional)</span>
        <input name="contact" maxLength={200} placeholder="Email or phone" className={input} />
      </label>
      <Turnstile />
      {state.error && <p role="alert" className="text-sm text-brand-700">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-ink px-4 py-3 font-medium text-white disabled:opacity-60">
        Send report
      </button>
    </form>
  );
}
