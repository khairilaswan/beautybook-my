"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createBookingRequest, type BookingState } from "@/app/shop/[slug]/actions";
import { Turnstile } from "@/components/turnstile";
import { useIsClient } from "@/components/use-is-client";
import { priceLabel } from "@/lib/format";
import { malaysiaNow, timeSlots } from "@/lib/hours";
import type { OpeningHours, Service } from "@/lib/types";

type Props = {
  listingId: string;
  services: Service[];
  hours: OpeningHours[];
};

const DAYS_AHEAD = 14;

function upcomingDates(): { value: string; label: string; weekday: number }[] {
  const today = malaysiaNow();
  const base = new Date(`${today.date}T12:00:00+08:00`);
  return Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = new Date(base.getTime() + i * 86_400_000);
    const value = d.toISOString().slice(0, 10);
    const label =
      i === 0
        ? "Today"
        : i === 1
          ? "Tomorrow"
          : new Intl.DateTimeFormat("en-MY", {
              weekday: "short",
              day: "numeric",
              month: "short",
              timeZone: "Asia/Kuala_Lumpur",
            }).format(d);
    return { value, label, weekday: (today.weekday + i) % 7 };
  });
}

export function BookingForm({ listingId, services, hours }: Props) {
  const [state, action, pending] = useActionState<BookingState, FormData>(createBookingRequest, {});
  const isClient = useIsClient();
  const dates = useMemo(() => (isClient ? upcomingDates() : []), [isClient]);
  const [date, setDate] = useState("");
  const selected = dates.find((d) => d.value === date);
  const slots = useMemo(() => {
    if (!selected) return [];
    const now = malaysiaNow();
    const all = hours.length > 0 ? timeSlots(hours, selected.weekday) : timeSlots(
      // Hours unknown: offer 10 AM to 9 PM.
      [{ weekday: selected.weekday, opens: "10:00", closes: "21:30" }],
      selected.weekday,
    );
    if (selected.value !== now.date) return all;
    return all.filter((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) > now.minutes + 30);
  }, [selected, hours]);

  useEffect(() => {
    if (state.whatsappUrl) window.location.href = state.whatsappUrl;
  }, [state.whatsappUrl]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="listingId" value={listingId} />
      <label className="block text-sm">
        <span className="font-medium">Service</span>
        <select name="serviceId" required className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2">
          {services.map((s) => {
            const price = priceLabel(s);
            return (
              <option key={s.id} value={s.id}>
                {s.name}
                {price ? ` (${price})` : ""}
              </option>
            );
          })}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">
          <span className="font-medium">Day</span>
          <select
            name="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
          >
            <option value="">Any day</option>
            {dates.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Time</span>
          <select
            name="time"
            disabled={!date}
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 disabled:bg-canvas"
          >
            <option value="">{date && slots.length === 0 ? "Closed" : "Any time"}</option>
            {slots.map((t) => (
              <option key={t} value={t}>
                {new Date(`2000-01-01T${t}:00`).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" })}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium">Your name</span>
        <input name="name" required maxLength={80} autoComplete="given-name" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Note (optional)</span>
        <input name="note" maxLength={300} placeholder="e.g. first visit, long hair" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" />
      </label>
      <Turnstile />
      {state.error && <p role="alert" className="text-sm text-brand-700">{state.error}</p>}
      <button
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 py-3 font-semibold text-white hover:brightness-95 disabled:opacity-60"
      >
        {pending ? "Opening WhatsApp…" : "Send request on WhatsApp"}
      </button>
      <p className="text-xs text-muted">
        This is a request, not a confirmed booking. The shop replies on WhatsApp to confirm.
      </p>
    </form>
  );
}
