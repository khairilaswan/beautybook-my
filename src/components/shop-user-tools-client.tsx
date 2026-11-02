"use client";

import { useOptimistic, useState, useTransition } from "react";
import { saveNote, toggleFavourite } from "@/app/[lang]/account/actions";
import { useI18n } from "@/lib/i18n/client";

type Props = { listingId: string; slug: string; saved: boolean; note: string };

export function ShopUserToolsClient({ listingId, slug, saved, note }: Props) {
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(saved);
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [noteStatus, setNoteStatus] = useState<string | null>(null);
  const { t } = useI18n();

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
          {optimisticSaved ? t.userTools.saved : t.userTools.save}
        </button>
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="rounded-full border border-line bg-white px-4 py-2 text-sm hover:border-brand-200"
        >
          {note ? t.userTools.myNote : t.userTools.addNote}
        </button>
      </div>
      {editing && (
        <form
          className="w-72 space-y-2 rounded-2xl border border-line bg-white p-3"
          action={async (form) => {
            await saveNote(listingId, slug, String(form.get("body") ?? ""));
            setNoteStatus(t.userTools.noteSaved);
          }}
        >
          <label className="block text-sm font-medium" htmlFor="private-note">
            {t.userTools.noteLabel}
          </label>
          <textarea
            id="private-note"
            name="body"
            defaultValue={note}
            maxLength={2000}
            rows={3}
            placeholder={t.userTools.notePlaceholder}
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">{noteStatus}</span>
            <button className="rounded-full bg-ink px-3 py-1 text-sm text-white">{t.userTools.saveNote}</button>
          </div>
        </form>
      )}
    </div>
  );
}
