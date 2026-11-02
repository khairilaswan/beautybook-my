"use client";

import { useState, useTransition } from "react";
import { type FormState, saveShopTheme } from "@/app/owner/actions";
import { ThemeControls } from "@/components/theme-controls";
import { ThemeSample } from "@/components/theme-sample";
import { type SiteTheme, themeLabel } from "@/lib/themes";

// Lets a shop owner give their shop page its own look, or keep the site's.
export function ShopThemePicker({
  listingId,
  slug,
  current,
  siteTheme,
}: {
  listingId: string;
  slug: string;
  current: SiteTheme | null;
  siteTheme: SiteTheme;
}) {
  const [own, setOwn] = useState(current !== null);
  const [picked, setPicked] = useState<SiteTheme>(current ?? siteTheme);
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  const shown = own ? picked : siteTheme;

  const save = () =>
    start(async () => {
      setState(await saveShopTheme(listingId, slug, own ? picked.style : null, own ? picked.color : null));
    });

  return (
    <div className="mt-3 rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name="shop-theme" checked={!own} onChange={() => { setOwn(false); setState({}); }} />
          Use the BeautyBook theme ({themeLabel(siteTheme)})
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="shop-theme" checked={own} onChange={() => { setOwn(true); setState({}); }} />
          Choose my own
        </label>
      </div>

      {own && (
        <ThemeControls
          value={picked}
          onChange={(t) => {
            setPicked(t);
            setState({});
          }}
        />
      )}

      <p className="mt-5 text-sm font-medium">Preview: {themeLabel(shown)}</p>
      <div className="mt-2 h-64 overflow-hidden rounded-xl border border-line">
        <ThemeSample theme={shown} className="w-[1100px] [zoom:0.3] sm:[zoom:0.55] lg:[zoom:0.86]" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-full bg-ink px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save theme"}
        </button>
        {state.error && <span role="alert" className="text-brand-700">{state.error}</span>}
        {state.message && <span className="text-whatsapp">{state.message}</span>}
      </div>
    </div>
  );
}
