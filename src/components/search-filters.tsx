"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { recordSearch } from "@/app/account/actions";
import { rememberSearch } from "@/components/recent-searches";
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

  function update(changes: Record<string, string | string[] | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      next.delete(key);
      if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
      else if (value) next.set(key, value);
    }
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(`/search?${qs}`, { scroll: false }));
    if (changes.q !== undefined || changes.category !== undefined || changes.area !== undefined) {
      rememberSearch(qs);
      // Saved to the account for signed-in users; a no-op for guests.
      void recordSearch(next.get("q"), next.get("category"), next.get("area"));
    }
  }

  const selectedAttrs = params.getAll("attr");
  const groups = ["audience", "service_mode", "language", "amenity"] as const;
  const groupNames = { audience: "Good for", service_mode: "How", language: "Languages", amenity: "Amenities" };

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
          placeholder="Shop name or service"
          className="w-full rounded-xl border border-line bg-white px-3 py-2"
        />
        <button className="rounded-xl bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
          Search
        </button>
      </div>
      <label className="block text-sm">
        <span className="font-medium">Service</span>
        <select
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
          value={params.get("category") ?? ""}
          onChange={(e) => update({ category: e.target.value })}
        >
          <option value="">All services</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name_en}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium">Area</span>
        <select
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
          value={params.get("area") ?? ""}
          onChange={(e) => update({ area: e.target.value })}
        >
          <option value="">All of Klang Valley</option>
          {areas
            .filter((a) => a.type !== "area")
            .map((city) => (
              <optgroup key={city.slug} label={city.name}>
                {city.type === "city" && <option value={city.slug}>All of {city.name}</option>}
                {areas
                  .filter((a) => a.parent_id === city.id)
                  .map((a) => (
                    <option key={a.slug} value={a.slug}>{a.name}</option>
                  ))}
              </optgroup>
            ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2 text-sm">
        <Toggle
          label="Open now"
          checked={params.get("open") === "1"}
          onChange={(on) => update({ open: on ? "1" : null })}
        />
        <Toggle
          label="Men"
          checked={params.get("for") === "men"}
          onChange={(on) => update({ for: on ? "men" : null })}
        />
        <Toggle
          label="Women"
          checked={params.get("for") === "women"}
          onChange={(on) => update({ for: on ? "women" : null })}
        />
      </div>
      {groups.map((group) => (
        <fieldset key={group} className="text-sm">
          <legend className="font-medium">{groupNames[group]}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {attributes
              .filter((a) => a.group_name === group)
              .map((a) => (
                <Toggle
                  key={a.slug}
                  label={a.name_en}
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
