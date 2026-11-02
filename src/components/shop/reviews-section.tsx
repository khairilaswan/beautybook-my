import { getReviews } from "@/lib/data/reviews";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

export function Stars({ value, className = "", label }: { value: number; className?: string; label?: string }) {
  const full = Math.round(value);
  return (
    <span className={`text-brand-600 ${className}`} aria-label={label ?? `${value} / 5`}>
      {"★".repeat(full)}
      <span className="text-line">{"★".repeat(5 - full)}</span>
    </span>
  );
}

// Only customers whose booking the shop completed can leave a review, so
// every review here is from a real visit.
export async function ReviewsSection({ listingId }: { listingId: string }) {
  const [{ reviews, summary }, { locale, t }] = await Promise.all([getReviews(listingId), getI18n()]);
  const g = t.growth.reviews;
  return (
    <section id="reviews">
      <h2 className="text-xl font-semibold">{g.title}</h2>
      {summary.count === 0 ? (
        <p className="mt-2 text-muted">{g.none}</p>
      ) : (
        <>
          <p className="mt-2 flex items-center gap-2">
            <Stars value={summary.average!} className="text-lg" label={fmt(g.outOf5, { value: summary.average! })} />
            <span className="font-semibold">{summary.average}</span>
            <span className="text-sm text-muted">{summary.count === 1 ? g.fromOne : fmt(g.fromMany, { count: summary.count })}</span>
          </p>
          <ul className="mt-3 space-y-3">
            {reviews.slice(0, 20).map((r) => (
              <li key={r.id} className="rounded-2xl border border-line bg-white p-4 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <Stars value={r.rating} label={fmt(g.outOf5, { value: r.rating })} />
                  <span className="font-medium">{r.author_name}</span>
                  <span className="text-muted">
                    · {r.service_name ? `${r.service_name} · ` : ""}
                    {formatDate(r.created_at, locale)}
                  </span>
                  <span className="rounded-full bg-green-50 px-2 text-xs text-whatsapp">{g.verified}</span>
                </p>
                {r.body && <p className="mt-2 whitespace-pre-line">{r.body}</p>}
                {r.owner_reply && (
                  <p className="mt-2 rounded-xl bg-canvas p-3">
                    <span className="font-medium">{g.reply} </span>
                    {r.owner_reply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
