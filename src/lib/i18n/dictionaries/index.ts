import type { Locale } from "@/lib/i18n/config";
import { en, type Dictionary } from "@/lib/i18n/dictionaries/en";
import { ms } from "@/lib/i18n/dictionaries/ms";
import { zh } from "@/lib/i18n/dictionaries/zh";

export type { Dictionary };
export const DICTIONARIES: Record<Locale, Dictionary> = { en, ms, zh };
