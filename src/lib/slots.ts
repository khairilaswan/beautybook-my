import { hhmm } from "@/lib/hours";
import type { BookingSettings, Closure, OpeningHours } from "@/lib/types";

export type Slot = { time: string; left: number };
export type Taken = { start: string; duration_min: number | null; staff_id: number | null };

const toMin = (t: string) => {
  const [h, m] = hhmm(t).split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// Minutes past midnight in Malaysia for a timestamp on `date` (UTC+8, no DST).
function localMinutes(iso: string, date: string): number | null {
  const ms = new Date(iso).getTime() - new Date(`${date}T00:00:00+08:00`).getTime();
  return ms >= -86_400_000 && ms < 2 * 86_400_000 ? Math.round(ms / 60_000) : null;
}

// Free start times on one day for a service of `duration` minutes. A slot is
// free when fewer than `capacity` bookings overlap it, and (if a stylist is
// chosen) that stylist has nothing overlapping.
export function freeSlots(args: {
  date: string; // YYYY-MM-DD, Malaysia
  weekday: number;
  hours: OpeningHours[];
  closures: Closure[];
  settings: BookingSettings;
  duration: number;
  taken: Taken[];
  staffId: number | null;
  nowMs: number;
}): Slot[] {
  const { date, weekday, hours, closures, settings, duration, taken, staffId, nowMs } = args;
  if (closures.some((c) => date >= c.date_from && date <= c.date_to)) return [];
  const earliest = nowMs + settings.min_notice_hours * 3_600_000;
  const busy = taken
    .map((b) => {
      const start = localMinutes(b.start, date);
      return start === null ? null : { start, end: start + (b.duration_min ?? settings.slot_minutes), staff: b.staff_id };
    })
    .filter((b) => b !== null);
  const out: Slot[] = [];
  for (const h of hours.filter((x) => x.weekday === weekday)) {
    const opens = toMin(h.opens);
    let closes = toMin(h.closes);
    if (closes <= opens) closes = 24 * 60;
    const step = settings.slot_minutes;
    for (let t = Math.ceil(opens / step) * step; t + duration <= closes; t += step) {
      const startMs = new Date(`${date}T${toHHMM(t)}:00+08:00`).getTime();
      if (startMs < earliest) continue;
      const overlapping = busy.filter((b) => b.start < t + duration && b.end > t);
      if (staffId !== null && overlapping.some((b) => b.staff === staffId)) continue;
      const left = settings.capacity - overlapping.length;
      if (left > 0) out.push({ time: toHHMM(t), left });
    }
  }
  const seen = new Set<string>();
  return out.filter((s) => !seen.has(s.time) && seen.add(s.time)).sort((a, b) => a.time.localeCompare(b.time));
}
