import { formatDate } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import type { Promotion } from "@/lib/types";

export async function DealsSection({ promotions, bookable }: { promotions: Promotion[]; bookable: boolean }) {
  const { locale, t } = await getI18n();
  return (
    <ul className="mt-3 grid gap-3 sm:grid-cols-2">
      {promotions.map((p) => (
        <li key={p.id} className="rounded-2xl border-2 border-brand-200 bg-brand-50 p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t.growth.occasions[p.occasion]}</p>
          <p className="mt-1 text-base font-semibold">{p.title}</p>
          {p.price_label && <p className="font-medium">{p.price_label}</p>}
          {p.details && <p className="mt-1 whitespace-pre-line">{p.details}</p>}
          <p className="mt-2 text-xs text-muted">
            {formatDate(p.starts_on, locale)} – {formatDate(p.ends_on, locale)}
          </p>
          {bookable && (
            <a href={`?deal=${p.id}#book`} className="mt-2 inline-block rounded-full bg-ink px-3 py-1 text-white">
              {t.growth.shop.bookDeal}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
