"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { type FormState, removePhoto } from "@/app/[lang]/owner/actions";
import { addTeamPhoto, saveVideo } from "@/app/[lang]/owner/media-actions";
import { photoUrl, videoUrl } from "@/lib/format";
import { uploadFile } from "@/lib/supabase/browser";

const box = "mt-3 space-y-3 rounded-2xl border border-line bg-white p-5 text-sm";
const ghostButton = "inline-block cursor-pointer rounded-full border border-line px-4 py-2 text-sm";
const VIDEO_MAX_MB = 30;

function Status({ state }: { state: FormState }) {
  if (state.error) return <span role="alert" className="text-sm text-brand-700">{state.error}</span>;
  if (state.message) return <span className="text-sm text-whatsapp">{state.message}</span>;
  return null;
}

function useSaver() {
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<FormState | void>) =>
    start(async () => {
      const result = await fn();
      setState(result ?? {});
    });
  return { state, pending, run };
}

export function VideoManager(props: { listingId: string; slug: string; videoPath: string | null }) {
  const { state, pending, run } = useSaver();
  return (
    <div className={box}>
      <p className="text-muted">
        One short video of your shop or your work, up to {VIDEO_MAX_MB} MB (about a minute). MP4, WebM or MOV.
      </p>
      {props.videoPath && (
        <video
          key={props.videoPath}
          src={videoUrl(props.videoPath)}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full max-w-md rounded-xl bg-black"
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className={ghostButton}>
          {pending ? "Uploading…" : props.videoPath ? "Replace video" : "Add a video"}
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="sr-only"
            disabled={pending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              run(async () => {
                const up = await uploadFile("listing-videos", props.listingId, file, VIDEO_MAX_MB * 1024 * 1024);
                if ("error" in up) return { error: up.error };
                return saveVideo(props.listingId, props.slug, up.path);
              });
            }}
          />
        </label>
        {props.videoPath && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => saveVideo(props.listingId, props.slug, null))}
            className="text-muted underline"
          >
            Remove video
          </button>
        )}
        <Status state={state} />
      </div>
    </div>
  );
}

export function TeamPhotosManager(props: {
  listingId: string;
  slug: string;
  photos: { id: number; storage_path: string }[];
}) {
  const { state, pending, run } = useSaver();
  return (
    <div className={box}>
      <p className="text-muted">Group photos of your team. They show above your team list on your shop page.</p>
      {props.photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {props.photos.map((p) => (
            <div key={p.id} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-brand-50">
              <Image src={photoUrl(p.storage_path)} alt="" fill sizes="25vw" className="object-cover" />
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => removePhoto(props.listingId, props.slug, p.id))}
                className="absolute right-1 top-1 rounded-full bg-white/90 px-2"
                aria-label="Remove photo"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className={ghostButton}>
          {pending ? "Uploading…" : "Add team photos"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={pending}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []).slice(0, 6);
              e.target.value = "";
              run(async () => {
                for (const file of files) {
                  const up = await uploadFile("listing-photos", props.listingId, file, 5 * 1024 * 1024);
                  if ("error" in up) return { error: up.error };
                  const r = await addTeamPhoto(props.listingId, props.slug, up.path);
                  if (r.error) return r;
                }
                return { message: files.length === 1 ? "Team photo added." : `${files.length} team photos added.` };
              });
            }}
          />
        </label>
        <Status state={state} />
      </div>
    </div>
  );
}
