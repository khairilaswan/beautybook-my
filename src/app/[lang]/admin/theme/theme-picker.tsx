"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type ActionState, saveSiteTheme, setOwnerThemes } from "@/app/[lang]/admin/actions";
import { ThemeSample } from "@/components/theme-sample";
import { setPreview } from "@/lib/theme-preview";
import { ThemeControls } from "@/components/theme-controls";
import { type SiteTheme, TEMPLATES, themeLabel } from "@/lib/themes";

const same = (a: SiteTheme, b: SiteTheme) => a.style === b.style && a.color === b.color;

export function ThemePicker({ current, ownerThemes }: { current: SiteTheme; ownerThemes: boolean }) {
  const [picked, setPicked] = useState<SiteTheme>(current);
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const router = useRouter();

  const pick = (theme: SiteTheme) => {
    setPicked(theme);
    setState({});
  };

  const save = () =>
    start(async () => {
      const result = await saveSiteTheme(picked.style, picked.color);
      setState(result);
      if (!result.error) {
        setPreview(null);
        router.refresh();
      }
    });

  const previewSite = () => {
    setPreview(picked);
    router.push("/");
  };

  return (
    <div className="pb-24">
      <OwnerThemesSwitch enabled={ownerThemes} />

      <h2 className="mt-8 text-lg font-semibold">Templates</h2>
      <p className="text-sm text-muted">Ready-made combinations. Pick one, then fine-tune below if you like.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((t) => {
          const selected = same(t.theme, picked);
          return (
            <div
              key={t.id}
              className={`relative overflow-hidden rounded-2xl border bg-white transition ${
                selected ? "border-ink ring-2 ring-ink" : "border-line hover:border-brand-200"
              }`}
            >
              <div className="h-44 overflow-hidden border-b border-line">
                <ThemeSample theme={t.theme} className="w-[1100px] [zoom:0.34]" />
              </div>
              <div className="p-3">
                <p className="font-semibold">
                  {t.name}
                  {same(t.theme, current) && (
                    <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Live now</span>
                  )}
                </p>
                <p className="text-xs text-muted">{themeLabel(t.theme)}</p>
                <p className="mt-1 text-sm">{t.blurb}</p>
              </div>
              {/* Covers the whole card, so the preview inside stays plain markup. */}
              <button
                type="button"
                onClick={() => pick(t.theme)}
                aria-pressed={selected}
                aria-label={`Choose ${t.name}`}
                className="absolute inset-0"
              />
            </div>
          );
        })}
      </div>

      <h2 className="mt-10 text-lg font-semibold">Or build your own</h2>
      <ThemeControls value={picked} onChange={pick} />

      <h2 className="mt-10 text-lg font-semibold">Preview: {themeLabel(picked)}</h2>
      <div className="mt-3 overflow-hidden rounded-2xl border border-line">
        <div className="overflow-x-auto">
          <ThemeSample theme={picked} className="min-w-[900px]" />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 text-sm">
          <span>
            Chosen: <strong>{themeLabel(picked)}</strong>
            {same(picked, current) && <span className="text-muted"> (live now)</span>}
          </span>
          {state.error && <span role="alert" className="text-brand-700">{state.error}</span>}
          {state.message && <span className="text-whatsapp">{state.message}</span>}
          <span className="ml-auto flex gap-2">
            <button type="button" onClick={previewSite} className="rounded-full border border-line bg-white px-4 py-2 font-medium">
              Preview on the whole site
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending || same(picked, current)}
              className="rounded-full bg-ink px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Use for everyone"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

function OwnerThemesSwitch({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      const result = await setOwnerThemes(!on);
      setState(result);
      if (!result.error) setOn(!on);
    });
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="owner-themes-label"
        onClick={toggle}
        disabled={pending}
        className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${on ? "bg-brand-600" : "bg-line"}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
      <div className="min-w-0 flex-1">
        <p id="owner-themes-label" className="font-medium">Let shop owners pick a theme for their own shop page</p>
        <p className="text-muted">
          {on
            ? "On: owners choose a style and colour in their dashboard. Turning it off puts every shop back on the site theme."
            : "Off: every shop page uses the site theme below."}
        </p>
      </div>
      {state.error && <span role="alert" className="text-brand-700">{state.error}</span>}
      {state.message && <span className="text-whatsapp">{state.message}</span>}
    </div>
  );
}
