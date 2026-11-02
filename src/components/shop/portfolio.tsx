"use client";

import Image from "next/image";
import { useState } from "react";
import { photoUrl } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { categoryName } from "@/lib/i18n/names";
import type { Category, Photo } from "@/lib/types";

// The shop's own work (nails, hair, lashes...), filterable by service.
export function Portfolio({ photos, categories, shopName }: { photos: Photo[]; categories: Category[]; shopName: string }) {
  const { locale, t } = useI18n();
  const g = t.growth.portfolio;
  const [tag, setTag] = useState<number | null>(null);
  const [open, setOpen] = useState<Photo | null>(null);
  const tags = categories.filter((c) => photos.some((p) => p.category_id === c.id));
  const shown = tag === null ? photos : photos.filter((p) => p.category_id === tag);
  return (
    <div>
      {tags.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Chip on={tag === null} onClick={() => setTag(null)}>{g.all}</Chip>
          {tags.map((c) => (
            <Chip key={c.id} on={tag === c.id} onClick={() => setTag(c.id)}>{categoryName(c, locale)}</Chip>
          ))}
        </div>
      )}
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setOpen(p)}
              className="relative block aspect-square w-full overflow-hidden rounded-xl bg-brand-50"
            >
              <Image
                src={photoUrl(p.storage_path)}
                alt={p.caption ?? p.alt ?? fmt(g.alt, { shop: shopName, n: i + 1 })}
                fill
                sizes="(min-width: 1024px) 20vw, 50vw"
                className="object-cover transition hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.caption ?? g.photo}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(null)}
        >
          <figure className="relative max-h-full w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-square w-full">
              <Image src={photoUrl(open.storage_path)} alt={open.caption ?? ""} fill sizes="90vw" className="object-contain" />
            </div>
            {open.caption && <figcaption className="mt-2 text-center text-white">{open.caption}</figcaption>}
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="absolute right-2 top-2 rounded-full bg-white px-3 py-1 text-sm"
            >
              {t.growth.common.close}
            </button>
          </figure>
        </div>
      )}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 ${on ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white"}`}
    >
      {children}
    </button>
  );
}
