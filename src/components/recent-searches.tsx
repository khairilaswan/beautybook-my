"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const KEY = "bb_recent_searches";
const MAX = 6;

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

// Recent searches live on the device, so guests get them too.
export function rememberSearch(query: string) {
  if (!query) return;
  try {
    const next = [query, ...read().filter((q) => q !== query)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(KEY));
  } catch {
    // Storage unavailable (private mode); nothing to remember.
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(KEY, onChange);
  return () => window.removeEventListener(KEY, onChange);
}

let cache: { raw: string | null; value: string[] } = { raw: null, value: [] };
function snapshot(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cache.value;
  }
  if (raw !== cache.raw) cache = { raw, value: read() };
  return cache.value;
}
const empty: string[] = [];

function describe(qs: string): string {
  const p = new URLSearchParams(qs);
  const parts = [p.get("q"), p.get("category")?.replace(/-/g, " "), p.get("area")?.replace(/-/g, " ")];
  return parts.filter(Boolean).join(" · ") || "All shops";
}

export function RecentSearches() {
  const searches = useSyncExternalStore(subscribe, snapshot, () => empty);
  if (searches.length === 0) return null;
  return (
    <div className="text-sm">
      <p className="font-medium">Recent searches</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {searches.map((qs) => (
          <li key={qs}>
            <Link href={`/search?${qs}`} className="inline-block rounded-full bg-white px-3 py-1 capitalize hover:bg-brand-50">
              {describe(qs)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
