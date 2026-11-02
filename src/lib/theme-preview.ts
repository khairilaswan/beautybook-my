"use client";

import { type SiteTheme, normalizeTheme } from "@/lib/themes";

// "Preview on the whole site" from /admin/theme: the chosen theme is kept in
// this browser only, and ThemePreviewBar applies it to every page until the
// preview is stopped. Nobody else sees it.
const KEY = "bb-theme-preview";
const EVENT = "bb-theme-preview";

export function readPreview(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function parsePreview(raw: string | null): SiteTheme | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { style?: unknown; color?: unknown };
    return normalizeTheme(v.style, v.color);
  } catch {
    return null;
  }
}

export function setPreview(theme: SiteTheme | null) {
  try {
    if (theme) localStorage.setItem(KEY, JSON.stringify(theme));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the preview just doesn't stick.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribePreview(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
