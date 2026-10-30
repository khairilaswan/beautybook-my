"use client";

import { useOptimistic, useState, useTransition } from "react";
import { saveNote, toggleFavourite } from "@/app/account/actions";

type Props = { listingId: string; slug: string; saved: boolean; note: string };

export function ShopUserToolsClient({ listingId, slug, saved, note }: Props) {
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(saved);
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [noteStatus, setNoteStatus] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={optimisticSaved}
          onClick={() =>
            startTransition(async () => {
              setOptimisticSaved(!optimisticSaved);
              await toggleFavourite(listingId, slug, !optimisticSaved);
            })
          }
          className="rounded-full border border-line bg-white px-4 py-2 text-sm hover:border-brand-200"
        >
          {optimisticSaved ? "♥ Saved" : "♡ Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="rounded-full border border-line bg-white px-4 py-2 text-sm hover:border-brand-200"
        >
          {note ? "My note" : "Add note"}
        </button>
      </div>
      {editing && (
        <form
          className="w-72 space-y-2 rounded-2xl border border-line bg-white p-3"
          action={async (form) => {
            await saveNote(listingId, slug, String(form.get("body") ?? ""));
            setNoteStatus("Saved");
          }}
        >
          <label className="block text-sm font-medium" htmlFor="private-note">
            Private note (only you can see it)
          </label>
          <textarea
            id="private-note"
            name="body"
            defaultValue={note}
            maxLength={2000}
            rows={3}
            placeholder="e.g. ask for Ahmad, #2 fade"
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">{noteStatus}</span>
            <button className="rounded-full bg-ink px-3 py-1 text-sm text-white">Save note</button>
          </div>
        </form>
      )}
    </div>
  );
}
