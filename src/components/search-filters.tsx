"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { recordSearch } from "@/app/[lang]/account/actions";
import { rememberSearch } from "@/components/recent-searches";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { areaName, attributeName, categoryName } from "@/lib/i18n/names";
import { mallGroups } from "@/lib/mall";
import { RADIUS_OPTIONS } from "@/lib/search-params";
import type { Area, Attribute, Category, Mall } from "@/lib/types";

// Shown together at the top: what many Malaysian customers check first.
const TRUST_FILTERS = ["muslim-friendly", "muslimah-friendly", "women-only", "female-stylists", "halal-products", "prayer-room"];

type Props = {
  categories: Category[];
  areas: Area[];
  attributes: Attribute[];
  malls: Mall[];
};

// Filters update the URL as they change, so results refresh instantly and
// every filtered view has a shareable, indexable address.
export function SearchFilters({ categories, areas, attributes, malls }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const { locale, t, href } = useI18n();
  const g = t.growth.filters;

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
    if (changes.q !== undefined || changes.category !== undefined || changes.area !== undefined || changes.mall !== undefined) {
      rememberSearch(qs);
      // Saved to the account for signed-in users; a no-op for guests.
      void recordSearch(next.get("q"), next.get("category"), next.get("area"));
    }
  }

  const selectedAttrs = params.getAll("attr");
  const groups = ["audience", "service_mode", "language", "amenity"] as const;
  const groupNames = { ...t.filters.groups, language: g.staffSpeak };
  const [locating, setLocating] = useState<string | null>(null);
  const toggleAttr = (slug: string, on: boolean) =>
    update({ attr: on ? [...selectedAttrs, slug] : selectedAttrs.filter((s) => s !== slug) });
  const quick = TRUST_FILTERS.map((slug) => attributes.find((a) => a.slug === slug)).filter((a) => !!a);
  const near = params.get("near");

  function findNearMe() {
    if (!("geolocation" in navigator)) {
      setLocating(g.noGeo);
      return;
    }
    setLocating(g.finding);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(null);
        update({
          near: `${pos.coords.latitude.toFixed(3)},${pos.coords.longitude.toFixed(3)}`,
          radius: params.get("radius") ?? "10",
          sort: "distance",
          area: null,
          mall: null,
        });
      },
      () => setLocating(g.geoBlocked),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

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
      <div className="rounded-2xl border border-line bg-white p-3 text-sm">
        {near ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{g.nearWithin}</span>
            <select
              aria-label={g.distance}
              className="rounded-lg border border-line px-2 py-1"
              value={params.get("radius") ?? "10"}
              onChange={(e) => update({ radius: e.target.value })}
            >
              {RADIUS_OPTIONS.map((r) => (
                <option key={r} value={r}>{r} km</option>
              ))}
            </select>
            <button type="button" className="ml-auto text-muted underline" onClick={() => update({ near: null, radius: null, sort: null })}>
              {g.clear}
            </button>
          </div>
        ) : (
          <button type="button" onClick={findNearMe} className="w-full rounded-xl bg-ink px-3 py-2 font-medium text-white">
            📍 {g.nearMe}
          </button>
        )}
        {locating && <p className="mt-2 text-xs text-muted" role="status">{locating}</p>}
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
          onChange={(e) => update({ area: e.target.value, mall: null, near: null, radius: null })}
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
      {malls.length > 0 && (
        <label className="block text-sm">
          <span className="font-medium">{t.growth.malls.mall}</span>
          <select
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
            value={params.get("mall") ?? ""}
            onChange={(e) => update({ mall: e.target.value, area: null, near: null, radius: null })}
          >
            <option value="">{t.growth.malls.anyMall}</option>
            {mallGroups(malls, areas).map(({ city, malls: inCity }) => (
              <optgroup key={city?.slug ?? "other"} label={city ? areaName(city, locale) : t.common.klangValley}>
                {inCity.map((m) => (
                  <option key={m.slug} value={m.slug}>{m.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      <div className="flex flex-wrap gap-2 text-sm">
        <Toggle
          label={t.common.openNow}
          checked={params.get("open") === "1"}
          onChange={(on) => update({ open: on ? "1" : null })}
        />
        <Toggle
          label={g.openLate}
          checked={params.get("late") === "1"}
          onChange={(on) => update({ late: on ? "1" : null })}
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
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="block">
          <span className="font-medium">{g.maxPrice}</span>
          <select
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
            value={params.get("max") ?? ""}
            onChange={(e) => update({ max: e.target.value })}
          >
            <option value="">{g.any}</option>
            {[30, 50, 100, 200, 500].map((n) => (
              <option key={n} value={n}>{fmt(g.under, { price: `RM${n}` })}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-medium">{g.sort}</span>
          <select
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
            value={params.get("sort") ?? ""}
            onChange={(e) => update({ sort: e.target.value })}
          >
            <option value="">{g.bestMatch}</option>
            <option value="price">{g.lowestPrice}</option>
            {near && <option value="distance">{g.nearest}</option>}
          </select>
        </label>
      </div>
      {quick.length > 0 && (
        <fieldset className="rounded-2xl bg-brand-50 p-3 text-sm">
          <legend className="sr-only">{g.trust}</legend>
          <p className="mb-2 font-medium">{g.trust}</p>
          <div className="flex flex-wrap gap-2">
            {quick.map((a) => (
              <Toggle key={a.slug} label={attributeName(a, locale)} checked={selectedAttrs.includes(a.slug)} onChange={(on) => toggleAttr(a.slug, on)} />
            ))}
          </div>
        </fieldset>
      )}
      {groups.map((group) => (
        <fieldset key={group} className="text-sm">
          <legend className="font-medium">{groupNames[group]}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {attributes
              .filter((a) => a.group_name === group && !TRUST_FILTERS.includes(a.slug))
              .map((a) => (
                <Toggle
                  key={a.slug}
                  label={attributeName(a, locale)}
                  checked={selectedAttrs.includes(a.slug)}
                  onChange={(on) => toggleAttr(a.slug, on)}
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
