"use client";
/* eslint-disable @next/next/no-img-element */
import { useActionState, useState, useTransition } from "react";
import type { WebsiteSettings } from "@/lib/website-settings";
import { saveWebsite, refreshSitemap } from "./actions";
const box = "mt-6 space-y-4 rounded-2xl border border-line bg-white p-5";
const field = "mt-1 block w-full rounded-lg border border-line px-3 py-2";
function ImageField({
  slot,
  label,
  url,
  hint,
}: {
  slot: string;
  label: string;
  url: string;
  hint?: string;
}) {
  const [preview, setPreview] = useState("");
  return (
    <div className="rounded-xl border border-line p-3">
      <label className="block text-sm font-medium" htmlFor={`file:${slot}`}>
        {label}
      </label>
      {(preview || url) && (
        <img
          src={preview || url}
          alt={`${label} preview`}
          className="my-2 h-24 max-w-full rounded-lg object-contain"
        />
      )}
      <input
        id={`file:${slot}`}
        name={`file:${slot}`}
        type="file"
        accept={
          slot === "favicon"
            ? "image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon"
            : "image/png,image/jpeg,image/webp"
        }
        className="mt-2 block w-full text-sm"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) {
            setPreview("");
            return;
          }
          const reader = new FileReader();
          reader.onload = () => setPreview(String(reader.result));
          reader.readAsDataURL(file);
        }}
      />
      <p className="mt-1 text-xs text-muted">
        {hint || "PNG, JPEG or WebP. Up to 2 MB."}
      </p>
      {url && (
        <label className="mt-2 block text-sm">
          <input type="checkbox" name={`remove:${slot}`} /> Remove current image
        </label>
      )}
    </div>
  );
}

function HeroSlidesEditor({ settings }: { settings: WebsiteSettings }) {
  const [slides, setSlides] = useState(() => {
    const initial = settings.heroSlides.length
      ? settings.heroSlides
      : settings.heroImage
        ? [{ id: "legacy-hero", image: settings.heroImage, alt: settings.heroAlt }]
        : [];
    return initial.map((slide) => ({ ...slide, preview: "" }));
  });
  const update = (id: string, changes: Partial<(typeof slides)[number]>) =>
    setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, ...changes } : slide));
  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name="heroSlides"
        value={JSON.stringify(slides.map(({ id, image, alt }) => ({ id, image, alt })))}
      />
      {slides.map((slide, index) => (
        <div key={slide.id} className="rounded-xl border border-line p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium">Slide {index + 1}</h3>
            <div className="flex gap-3 text-sm">
              <button type="button" disabled={index === 0} className="underline disabled:opacity-40" aria-label={`Move slide ${index + 1} up`} onClick={() => setSlides((current) => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>Move up</button>
              <button type="button" disabled={index === slides.length - 1} className="underline disabled:opacity-40" aria-label={`Move slide ${index + 1} down`} onClick={() => setSlides((current) => { const next = [...current]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })}>Move down</button>
              <button type="button" className="text-red-700 underline" onClick={() => setSlides((current) => current.filter((item) => item.id !== slide.id))}>Remove</button>
            </div>
          </div>
          {(slide.preview || slide.image) && <img src={slide.preview || slide.image} alt={`Hero slide ${index + 1} preview`} className="my-2 h-28 w-full rounded-lg object-cover" />}
          <label className="block text-sm">
            {slide.image ? "Replace image" : "Choose image"}
            <input name={`file:heroSlide:${slide.id}`} type="file" accept="image/png,image/jpeg,image/webp" className="mt-1 block w-full text-sm" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) { update(slide.id, { preview: "" }); return; }
              const reader = new FileReader();
              reader.onload = () => update(slide.id, { preview: String(reader.result) });
              reader.readAsDataURL(file);
            }} />
          </label>
          <p className="mt-1 text-xs text-muted">Wide landscape PNG, JPEG or WebP. Up to 2 MB.</p>
          <label className="mt-2 block text-sm">Image description (alt text)
            <input className={field} value={slide.alt} maxLength={200} onChange={(event) => update(slide.id, { alt: event.target.value })} />
          </label>
        </div>
      ))}
      <button type="button" disabled={slides.length >= 10} className="rounded-lg border border-line px-4 py-2 text-sm disabled:opacity-50" onClick={() => setSlides((current) => [...current, { id: crypto.randomUUID(), image: "", alt: "", preview: "" }])}>Add hero image</button>
      <label className="block text-sm">Rotate every (seconds)
        <input className={field} type="number" name="heroInterval" min={3} max={20} step={1} defaultValue={settings.heroInterval} />
        <span className="text-xs text-muted">Choose 3–20 seconds. Visitors can also move between slides manually.</span>
      </label>
    </div>
  );
}

export function WebsiteForm({
  settings: s,
  categories,
}: {
  settings: WebsiteSettings;
  categories: { slug: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveWebsite, {});
  const [refreshing, start] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <>
      <form action={action}>
        <section className={box}>
          <h2 className="text-lg font-semibold">Branding</h2>
          <label className="block">
            Website name
            <input
              className={field}
              name="name"
              defaultValue={s.name}
              required
              maxLength={80}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <ImageField
              slot="logo"
              label="Website logo"
              url={s.logo}
              hint="Transparent PNG recommended. Up to 2 MB."
            />
            <ImageField
              slot="favicon"
              label="Favicon"
              url={s.favicon}
              hint="Square PNG or ICO, ideally 48 × 48 or larger. Up to 2 MB."
            />
          </div>
        </section>
        <section className={box}>
          <h2 className="text-lg font-semibold">
            Search appearance & homepage text
          </h2>
          <p className="text-sm text-muted">
            Blank text uses the existing translation. Page-specific titles and
            descriptions take priority over site defaults.
          </p>
          {(
            [
              ["en", "English"],
              ["ms", "Bahasa Melayu"],
              ["zh", "中文"],
            ] as const
          ).map(([locale, label]) => (
            <fieldset
              key={locale}
              className="space-y-3 rounded-xl border border-line p-4"
            >
              <legend className="px-2 font-semibold">{label}</legend>
              {(
                [
                  ["title", "Default meta title", 100],
                  ["description", "Default meta description", 320],
                  ["heroTitle", "Hero heading", 160],
                  ["heroLead", "Hero introduction", 500],
                ] as const
              ).map(([key, text, max]) => (
                <label key={key} className="block text-sm">
                  {text}
                  {key === "description" || key === "heroLead" ? (
                    <textarea
                      className={field}
                      name={`${locale}.${key}`}
                      defaultValue={s[locale][key]}
                      maxLength={max}
                      rows={3}
                    />
                  ) : (
                    <input
                      className={field}
                      name={`${locale}.${key}`}
                      defaultValue={s[locale][key]}
                      maxLength={max}
                    />
                  )}
                </label>
              ))}
            </fieldset>
          ))}
          <ImageField
            slot="socialImage"
            label="Default social sharing image"
            url={s.socialImage}
            hint="Recommended 1200 × 630. Up to 2 MB."
          />
          <label className="block text-sm">
            Google Search Console verification code
            <input
              className={field}
              name="googleVerification"
              defaultValue={s.googleVerification}
              maxLength={200}
            />
            <span className="text-xs text-muted">
              Paste only the content value from Google verification meta tag.
            </span>
          </label>
        </section>
        <section className={box}>
          <h2 className="text-lg font-semibold">Homepage images</h2>
          <p className="text-sm text-muted">Add up to 10 images. They rotate automatically on the homepage, and visitors can browse them with the slide controls.</p>
          <HeroSlidesEditor settings={s} />
          <ImageField
            slot="businessImage"
            label="For businesses section image"
            url={s.businessImage}
          />
          <label className="block text-sm">
            Business image description
            <input
              className={field}
              name="businessAlt"
              defaultValue={s.businessAlt}
              maxLength={200}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {categories.map((c) => (
              <ImageField
                key={c.slug}
                slot={`category:${c.slug}`}
                label={c.name}
                url={s.categoryImages[c.slug] || ""}
                hint="Service category image, square crop. Up to 2 MB."
              />
            ))}
          </div>
        </section>
        <section className={box}>
          <h2 className="text-lg font-semibold">Search indexing</h2>
          <label className="block text-sm">
            <input
              name="indexing"
              type="checkbox"
              defaultChecked={s.indexing}
            />{" "}
            Allow public pages to appear in search engines
          </label>
          <p className="text-sm text-muted">
            Turning this off adds noindex, blocks crawlers in robots.txt and
            empties the sitemap. Member-only sites remain private regardless of
            this setting.
          </p>
        </section>
        <div className="sticky bottom-0 mt-5 border-t border-line bg-white p-4">
          <p role="status" aria-live="polite" className="mb-2 text-sm">
            {state.error || state.message}
          </p>
          <button
            disabled={pending}
            className="rounded-lg bg-brand-600 px-5 py-2 text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save website settings"}
          </button>
          <span className="ml-3 text-xs text-muted">
            Up to 12 MB of images per save.
          </span>
        </div>
      </form>
      <section className={box}>
        <h2 className="text-lg font-semibold">Sitemap & crawler files</h2>
        <p className="text-sm text-muted">
          The sitemap is generated automatically from public listings, published
          guides and eligible location pages in all supported languages.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <a
            className="underline"
            href="/sitemap.xml"
            target="_blank"
            rel="noreferrer"
          >
            View sitemap.xml
          </a>
          <a
            className="underline"
            href="/robots.txt"
            target="_blank"
            rel="noreferrer"
          >
            View robots.txt
          </a>
          <button
            disabled={refreshing}
            className="underline"
            onClick={() =>
              start(async () => {
                const result = await refreshSitemap();
                setMessage(result.error || result.message || "");
              })
            }
          >
            {refreshing ? "Refreshing…" : "Refresh sitemap"}
          </button>
        </div>
        <p role="status" className="text-sm">
          {message}
        </p>
      </section>
    </>
  );
}
