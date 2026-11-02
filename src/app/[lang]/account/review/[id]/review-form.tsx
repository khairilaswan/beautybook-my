"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveReview, type ReviewState } from "@/app/[lang]/account/actions";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";

const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export function ReviewForm(props: {
  bookingId: string;
  initial: { rating: number; body: string | null; author_name: string };
  shopHref: string;
}) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(saveReview, {});
  const [rating, setRating] = useState(props.initial.rating);
  const { t } = useI18n();
  const g = t.growth.review;
  if (state.done) {
    return (
      <p className="mt-6 rounded-2xl bg-green-50 p-4 text-sm">
        {g.thanks} <Link href={`${props.shopHref}#reviews`} className="underline">{g.seeIt}</Link>
      </p>
    );
  }
  return (
    <form action={action} className="mt-6 space-y-4 rounded-2xl border border-line bg-white p-5 text-sm">
      <input type="hidden" name="bookingId" value={props.bookingId} />
      <input type="hidden" name="rating" value={rating} />
      <fieldset>
        <legend className="font-medium">{g.yourRating}</legend>
        <div className="mt-1 flex gap-1 text-3xl" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={fmt(t.growth.reviews.outOf5, { value: n })}
              onClick={() => setRating(n)}
              className={n <= rating ? "text-brand-600" : "text-line"}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="font-medium">{g.yourReview}</span>
        <textarea name="body" defaultValue={props.initial.body ?? ""} maxLength={1000} rows={4} placeholder={g.placeholder} className={input} />
      </label>
      <label className="block">
        <span className="font-medium">{g.nameToShow}</span>
        <input name="authorName" defaultValue={props.initial.author_name} maxLength={40} required className={input} />
      </label>
      {state.error && <p role="alert" className="text-brand-700">{state.error}</p>}
      <button disabled={pending} className="rounded-full bg-ink px-5 py-2 font-medium text-white disabled:opacity-60">
        {pending ? g.posting : g.post}
      </button>
    </form>
  );
}
