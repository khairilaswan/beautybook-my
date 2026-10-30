"use client";

import { useState, useTransition } from "react";
import { setDiscoveryStatus } from "@/app/admin/actions";

export function DiscoveryRow({ placeId, term, cell, status }: { placeId: string; term: string; cell: string; status: string }) {
  const [pending, start] = useTransition();
  const [slug, setSlug] = useState("");
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 p-3">
      <span>
        <a
          href={`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline"
        >
          Open in Google Maps
        </a>
        <span className="ml-2 text-muted">“{term}” · {cell}</span>
      </span>
      {status === "new" && (
        <span className="flex flex-wrap items-center gap-2">
          <a href="/admin/listings/new" target="_blank" className="rounded-full border border-line px-3 py-1">Add listing</a>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="listing slug" className="rounded-xl border border-line px-2 py-1" />
          <button disabled={pending || !slug} onClick={() => start(() => setDiscoveryStatus(placeId, "collected", slug))} className="rounded-full bg-ink px-3 py-1 text-white disabled:opacity-50">
            Collected
          </button>
          <button disabled={pending} onClick={() => start(() => setDiscoveryStatus(placeId, "skipped"))} className="rounded-full border border-line px-3 py-1">
            Skip
          </button>
        </span>
      )}
    </li>
  );
}
