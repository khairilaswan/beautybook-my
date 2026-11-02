// Copied from the website's src/lib/hours.ts, except malaysiaNow (see below).
import type { Locale } from "@/lib/i18n/config";
import { localTime, weekdayName } from "@/lib/i18n/names";
import type { Closure, OpeningHours } from "@/lib/types";

export const TIME_ZONE = "Asia/Kuala_Lumpur";
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// schema.org dayOfWeek values, same order as WEEKDAYS.
export const SCHEMA_DAYS = WEEKDAYS.map((d) => `https://schema.org/${d}`);

// "10:00:00" -> "10:00"
export function hhmm(time: string): string {
  return time.slice(0, 5);
}

// "13:30" -> "1:30 PM"
export function formatTime(time: string): string {
  const [h, m] = hhmm(time).split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

// Current weekday (0 = Sunday), date and minutes past midnight in Malaysia.
// Malaysia is UTC+8 all year (no daylight saving), so plain arithmetic is
// exact and avoids Intl features that differ between phone engines.
export function malaysiaNow(at: Date = new Date()): { weekday: number; date: string; minutes: number } {
  const local = new Date(at.getTime() + 8 * 3_600_000);
  return {
    weekday: local.getUTCDay(),
    date: local.toISOString().slice(0, 10),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

function toMinutes(time: string): number {
  const [h, m] = hhmm(time).split(":").map(Number);
  return h * 60 + m;
}

// Mirrors public.is_open_at in SQL: slots where closes <= opens run past midnight.
export function isOpenAt(hours: OpeningHours[], closures: Closure[], at: Date = new Date()): boolean {
  const now = malaysiaNow(at);
  if (closures.some((c) => now.date >= c.date_from && now.date <= c.date_to)) return false;
  const yesterday = (now.weekday + 6) % 7;
  return hours.some((h) => {
    const opens = toMinutes(h.opens);
    const closes = toMinutes(h.closes);
    if (closes > opens) {
      return h.weekday === now.weekday && now.minutes >= opens && now.minutes < closes;
    }
    return (
      (h.weekday === now.weekday && now.minutes >= opens) ||
      (h.weekday === yesterday && now.minutes < closes)
    );
  });
}

// Hours grouped by weekday, Monday first, for display.
export function weeklySchedule(
  hours: OpeningHours[],
  locale: Locale = "en",
): { weekday: number; label: string; slots: string[] }[] {
  return [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
    weekday,
    label: weekdayName(weekday, locale),
    slots: hours
      .filter((h) => h.weekday === weekday)
      .sort((a, b) => a.opens.localeCompare(b.opens))
      .map((h) => `${localTime(h.opens, locale)} – ${localTime(h.closes, locale)}`),
  }));
}

// Booking time choices for a date, every 30 minutes inside opening hours,
// leaving room for at least 30 minutes before closing.
export function timeSlots(hours: OpeningHours[], weekday: number): string[] {
  const slots: string[] = [];
  for (const h of hours.filter((x) => x.weekday === weekday)) {
    const opens = toMinutes(h.opens);
    let closes = toMinutes(h.closes);
    if (closes <= opens) closes = 24 * 60;
    for (let t = Math.ceil(opens / 30) * 30; t + 30 <= closes; t += 30) {
      slots.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
    }
  }
  return [...new Set(slots)].sort();
}
