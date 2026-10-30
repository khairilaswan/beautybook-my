"use client";

import { useState, useTransition } from "react";
import { markVerified, mergeListings, setListingStatus } from "@/app/admin/actions";

export function ListingAdminTools({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [mergeSlug, setMergeSlug] = useState("");
  const btn = "rounded-full border border-line bg-white px-3 py-1.5 text-sm disabled:opacity-50";
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} className={btn} onClick={() => start(() => markVerified(id))}>Mark checked today</button>
        {status === "archived" ? (
          <button disabled={pending} className={btn} onClick={() => start(() => setListingStatus(id, "active"))}>Restore</button>
        ) : (
          <button disabled={pending} className={btn} onClick={() => start(() => setListingStatus(id, "archived"))}>Archive</button>
        )}
      </div>
      <form
        className="flex gap-2 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await mergeListings(id, mergeSlug);
            setMessage(r.error ?? r.message ?? null);
          });
        }}
      >
        <input value={mergeSlug} onChange={(e) => setMergeSlug(e.target.value)} placeholder="duplicate's slug" className="rounded-xl border border-line px-2 py-1" />
        <button disabled={pending || !mergeSlug} className={btn}>Merge into this</button>
      </form>
      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}
