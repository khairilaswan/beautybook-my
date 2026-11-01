"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { parsePreview, readPreview, setPreview, subscribePreview } from "@/lib/theme-preview";
import { themeLabel } from "@/lib/themes";

// Shows the theme being previewed in this browser and applies it to <body>,
// over the saved site theme.
export function ThemePreviewBar() {
  const raw = useSyncExternalStore(subscribePreview, readPreview, () => null);
  const preview = parsePreview(raw);

  useEffect(() => {
    const body = document.body;
    const saved = { style: body.dataset.style, color: body.dataset.color };
    if (preview) {
      body.dataset.style = preview.style;
      body.dataset.color = preview.color;
    }
    return () => {
      body.dataset.style = saved.style;
      body.dataset.color = saved.color;
    };
  }, [preview?.style, preview?.color]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!preview) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-ink px-4 py-2 text-sm text-white">
      <span>
        Previewing <strong>{themeLabel(preview)}</strong>. Only you can see this.
      </span>
      <Link href="/admin/theme" className="underline">Back to themes</Link>
      <button onClick={() => setPreview(null)} className="rounded-full bg-white px-3 py-1 font-medium text-ink">
        Stop preview
      </button>
    </div>
  );
}
