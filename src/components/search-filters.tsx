"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { recordSearch } from "@/app/[lang]/account/actions";
import { rememberSearch } from "@/components/recent-searches";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { areaName, attributeName, categoryName } from "@/lib/i18n/names";
import type { Area, Attribute, Category } from "@/lib/types";

type Props = {
  categories: Category[];
  areas: Area[];
  attributes: Attribute[];
};

// Filters update the URL as they change, so results refresh instantly and
// every filtered view has a shareable, indexable address.
export function SearchFilters({ categories, areas, attributes }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const { locale, t, href } = useI18n();

  function update(changes: Record<string, string | string[] | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      next.delete(key);
      if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
      else if (value) next.set(key, value);
    }
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(href(`/search?${qs}`), { scroll: false }));
    if (changes.q !== undefined || changes.category !== undefined || changes.area !== undefined) {
      rememberSearch(qs);
      // Saved to the account for signed-in users; a no-op for guests.
      void recordSearch(next.get("q"), next.get("category"), next.get("area"));
    }
  }

  const selectedAttrs = params.getAll("attr");
  const groups = ["audience", "service_mode", "language", "amenity"] as const;

  return (
    <form
      role="search"
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        update({ q: new FormData(e.currentTarget).get("q") as string });
      }}
      aria-busy={pending}
    >
      <div className="flex gap-2">
        <input
          name="q"
          type="search"
          defaultValue={params.get("q") ?? ""}
          placeholder={t.filters.placeholder}
          className="w-full rounded-xl border border-line bg-white px-3 py-2"
        />
        <button className="rounded-xl bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
          {t.common.search}
        </button>
      </div>
      <label className="block text-sm">
        <span className="font-medium">{t.common.service}</span>
        <select
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
          value={params.get("category") ?? ""}
          onChange={(e) => update({ category: e.target.value })}
        >
          <option value="">{t.filters.allServices}</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{categoryName(c, locale)}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium">{t.common.area}</span>
        <select
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
          value={params.get("area") ?? ""}
          onChange={(e) => update({ area: e.target.value })}
        >
          <option value="">{t.common.allKlangValley}</option>
          {areas
            .filter((a) => a.type !== "area")
            .map((city) => (
              <optgroup key={city.slug} label={areaName(city, locale)}>
                {city.type === "city" && (
                  <option value={city.slug}>{fmt(t.common.allOf, { area: areaName(city, locale) })}</option>
                )}
                {areas
                  .filter((a) => a.parent_id === city.id)
                  .map((a) => (
                    <option key={a.slug} value={a.slug}>{areaName(a, locale)}</option>
                  ))}
              </optgroup>
            ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2 text-sm">
        <Toggle
          label={t.common.openNow}
          checked={params.get("open") === "1"}
          onChange={(on) => update({ open: on ? "1" : null })}
        />
        <Toggle
          label={t.common.gender.men}
          checked={params.get("for") === "men"}
          onChange={(on) => update({ for: on ? "men" : null })}
        />
        <Toggle
          label={t.common.gender.women}
          checked={params.get("for") === "women"}
          onChange={(on) => update({ for: on ? "women" : null })}
        />
      </div>
      {groups.map((group) => (
        <fieldset key={group} className="text-sm">
          <legend className="font-medium">{t.filters.groups[group]}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {attributes
              .filter((a) => a.group_name === group)
              .map((a) => (
                <Toggle
                  key={a.slug}
                  label={attributeName(a, locale)}
                  checked={selectedAttrs.includes(a.slug)}
                  onChange={(on) =>
                    update({
                      attr: on ? [...selectedAttrs, a.slug] : selectedAttrs.filter((s) => s !== a.slug),
                    })
                  }
                />
              ))}
          </div>
        </fieldset>
      ))}
    </form>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`rounded-full border px-3 py-1 ${
        checked ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:border-brand-200"
      }`}
    >
      {label}
    </button>
  );
}
