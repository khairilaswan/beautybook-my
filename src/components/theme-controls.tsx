"use client";

import { PALETTES, STYLES, STYLE_COLORS, type SiteTheme, normalizeTheme } from "@/lib/themes";

const chosen = "border-ink ring-2 ring-ink";

// Style buttons and colour swatches, shared by the admin and shop owner pickers.
export function ThemeControls({ value, onChange }: { value: SiteTheme; onChange: (theme: SiteTheme) => void }) {
  return (
    <>
      <fieldset className="mt-3">
        <legend className="text-sm font-medium">Style</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-5">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(normalizeTheme(s.id, value.color))}
              aria-pressed={value.style === s.id}
              className={`rounded-xl border bg-white p-3 text-left text-sm ${
                value.style === s.id ? chosen : "border-line hover:border-brand-200"
              }`}
            >
              <span className="block font-semibold">{s.name}</span>
              <span className="mt-1 block text-xs text-muted">{s.blurb}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">Colour</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {STYLE_COLORS[value.style].map((c) => {
            const p = PALETTES[c];
            const accent = "accent" in p ? p.accent : p.scale;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ style: value.style, color: c })}
                aria-pressed={value.color === c}
                className={`flex items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-3 text-sm ${
                  value.color === c ? chosen : "border-line"
                }`}
              >
                <span
                  className="size-7 rounded-full"
                  style={{ background: `linear-gradient(135deg, ${p.scale[6]} 50%, ${accent[4]} 50%)` }}
                />
                {p.name}
              </button>
            );
          })}
        </div>
      </fieldset>
    </>
  );
}
