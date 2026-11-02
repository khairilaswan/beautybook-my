"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";

// Up to three shops picked for side-by-side comparison, kept on the device.
const KEY = "bb_compare";
export const MAX_COMPARE = 3;

type Picked = { slug: string; name: string };

function read(): Picked[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? (value as Picked[]).slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

function write(next: Picked[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable; the tray just stays empty.
  }
  window.dispatchEvent(new Event(KEY));
}

function subscribe(onChange: () => void) {
  window.addEventListener(KEY, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(KEY, onChange);
    window.removeEventListener("storage", onChange);
  };
}

let cache: { raw: string | null; value: Picked[] } = { raw: null, value: [] };
function snapshot(): Picked[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cache.value;
  }
  if (raw !== cache.raw) cache = { raw, value: read() };
  return cache.value;
}
const empty: Picked[] = [];

function usePicked(): Picked[] {
  return useSyncExternalStore(subscribe, snapshot, () => empty);
}

export function compareHref(slugs: string[]): string {
  return `/compare?s=${slugs.map(encodeURIComponent).join(",")}`;
}

export function CompareButton({ slug, name, className = "" }: Picked & { className?: string }) {
  const picked = usePicked();
  const { t } = useI18n();
  const g = t.growth.compare;
  const on = picked.some((p) => p.slug === slug);
  const full = !on && picked.length >= MAX_COMPARE;
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={full}
      title={full ? fmt(g.max, { count: MAX_COMPARE }) : undefined}
      onClick={() => write(on ? picked.filter((p) => p.slug !== slug) : [...picked, { slug, name }])}
      className={`rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
        on ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white/95 hover:border-brand-200"
      } ${className}`}
    >
      {on ? `✓ ${g.comparing}` : `+ ${g.compare}`}
    </button>
  );
}

// Sits at the bottom of every page once a shop is picked.
export function CompareTray() {
  const picked = usePicked();
  const { t, href } = useI18n();
  const g = t.growth.compare;
  if (picked.length === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3 text-sm">
        <span className="font-medium">{g.trayLabel}</span>
        {picked.map((p) => (
          <span key={p.slug} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1">
            {p.name}
            <button
              type="button"
              aria-label={fmt(g.remove, { name: p.name })}
              onClick={() => write(picked.filter((x) => x.slug !== p.slug))}
              className="text-muted hover:text-ink"
            >
              ✕
            </button>
          </span>
        ))}
        <span className="ml-auto flex gap-2">
          <button type="button" onClick={() => write([])} className="rounded-full px-3 py-1.5 text-muted underline">
            {g.clear}
          </button>
          {picked.length >= 2 ? (
            <Link
              href={href(compareHref(picked.map((p) => p.slug)))}
              className="rounded-full bg-brand-600 px-4 py-1.5 font-medium text-white hover:bg-brand-700"
            >
              {fmt(g.compareN, { count: picked.length })}
            </Link>
          ) : (
            <span className="rounded-full px-3 py-1.5 text-muted">{g.pickOne}</span>
          )}
        </span>
      </div>
    </div>
  );
}
