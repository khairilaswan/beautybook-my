"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { createBookingRequest, getAvailability, type BookingState } from "@/app/[lang]/salon/[slug]/actions";
import { Turnstile } from "@/components/turnstile";
import { useIsClient } from "@/components/use-is-client";
import { priceLabel } from "@/lib/format";
import { malaysiaNow, timeSlots } from "@/lib/hours";
import { useI18n } from "@/lib/i18n/client";
import { HTML_LANG, type Locale, fmt } from "@/lib/i18n/config";
import { localTime, serviceName } from "@/lib/i18n/names";
import type { Slot } from "@/lib/slots";
import type { BookingSettings, OpeningHours, Promotion, Service, StaffMember } from "@/lib/types";

type Props = {
  listingId: string;
  services: Service[];
  hours: OpeningHours[];
  staff?: Pick<StaffMember, "id" | "name" | "title">[];
  promotions?: Pick<Promotion, "id" | "title" | "price_label" | "starts_on" | "ends_on">[];
  // Instant booking into free slots, when the shop has switched it on.
  instant?: BookingSettings | null;
};

const DAYS_AHEAD = 14;

function upcomingDates(
  days: number,
  locale: Locale,
  words: { today: string; tomorrow: string },
): { value: string; label: string; weekday: number }[] {
  const today = malaysiaNow();
  const base = new Date(`${today.date}T12:00:00+08:00`);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(base.getTime() + i * 86_400_000);
    const value = d.toISOString().slice(0, 10);
    const label =
      i === 0
        ? words.today
        : i === 1
          ? words.tomorrow
          : new Intl.DateTimeFormat(HTML_LANG[locale], {
              weekday: "short",
              day: "numeric",
              month: "short",
              timeZone: "Asia/Kuala_Lumpur",
            }).format(d);
    return { value, label, weekday: (today.weekday + i) % 7 };
  });
}

// Picks up ?service=, ?staff= and ?deal= from the page URL ("book again",
// "book this deal", "book with this stylist").
function useUrlChoice(key: string): string {
  const isClient = useIsClient();
  return isClient ? (new URLSearchParams(window.location.search).get(key) ?? "") : "";
}

export function BookingForm({ listingId, services, hours, staff = [], promotions = [], instant = null }: Props) {
  const [state, action, pending] = useActionState<BookingState, FormData>(createBookingRequest, {});
  const isClient = useIsClient();
  const { locale, t } = useI18n();
  const g = t.growth.booking;
  const instantOn = !!instant?.instant_enabled;
  const dates = useMemo(
    () =>
      isClient
        ? upcomingDates(instantOn ? instant!.max_days_ahead : DAYS_AHEAD, locale, {
            today: t.booking.today,
            tomorrow: t.booking.tomorrow,
          })
        : [],
    [isClient, instantOn, instant, locale, t],
  );
  const [date, setDate] = useState("");
  const urlService = useUrlChoice("service");
  const urlStaff = useUrlChoice("staff");
  const urlDeal = useUrlChoice("deal");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const service = serviceId ?? (services.some((s) => String(s.id) === urlService) ? urlService : String(services[0]?.id ?? ""));
  const stylist = staffId ?? (staff.some((s) => String(s.id) === urlStaff) ? urlStaff : "");
  const today = isClient ? malaysiaNow().date : "";
  const liveDeals = promotions.filter((p) => p.starts_on <= today && p.ends_on >= today);
  const selected = dates.find((d) => d.value === date);

  // Request mode: every 30 minutes inside opening hours.
  const requestSlots = useMemo(() => {
    if (!selected || instantOn) return [];
    const now = malaysiaNow();
    const all =
      hours.length > 0
        ? timeSlots(hours, selected.weekday)
        : timeSlots([{ weekday: selected.weekday, opens: "10:00", closes: "21:30" }], selected.weekday);
    if (selected.value !== now.date) return all;
    return all.filter((x) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3)) > now.minutes + 30);
  }, [selected, hours, instantOn]);

  // Instant mode: ask the server which slots are still free.
  const [free, setFree] = useState<{ key: string; slots: Slot[] } | null>(null);
  const [loadingSlots, startLoading] = useTransition();
  const freeKey = `${date}|${service}|${stylist}`;
  useEffect(() => {
    if (!instantOn || !date || !service) return;
    startLoading(async () => {
      const slots = await getAvailability({
        listingId,
        date,
        serviceId: Number(service),
        staffId: stylist ? Number(stylist) : null,
      });
      setFree({ key: `${date}|${service}|${stylist}`, slots });
    });
  }, [instantOn, listingId, date, service, stylist]);
  const instantSlots = free?.key === freeKey ? free.slots : [];

  useEffect(() => {
    // A confirmed booking shows its summary first; WhatsApp is optional then.
    if (state.whatsappUrl && !state.confirmed) window.location.href = state.whatsappUrl;
  }, [state.whatsappUrl, state.confirmed]);

  if (state.confirmed) {
    return (
      <div className="space-y-3" role="status">
        <p className="rounded-xl bg-green-50 p-3 text-sm">
          <strong>{g.booked}</strong>{" "}
          {fmt(g.bookedAt, { shop: state.confirmed.shopName, when: state.confirmed.when })}{" "}
          {g.code} <strong>{state.confirmed.shortCode}</strong>
        </p>
        {state.whatsappUrl && (
          <a
            href={state.whatsappUrl}
            className="flex w-full items-center justify-center rounded-xl bg-whatsapp px-4 py-3 font-semibold text-white"
          >
            {g.tellShop}
          </a>
        )}
        <p className="text-xs text-muted">{g.findIt}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="listingId" value={listingId} />
      <label className="block text-sm">
        <span className="font-medium">{t.common.service}</span>
        <select
          name="serviceId"
          required
          value={service}
          onChange={(e) => setServiceId(e.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
        >
          {services.map((s) => {
            const price = priceLabel(s, locale);
            return (
              <option key={s.id} value={s.id}>
                {serviceName(s, locale)}
                {price ? ` (${price})` : ""}
              </option>
            );
          })}
        </select>
      </label>
      {staff.length > 0 && (
        <label className="block text-sm">
          <span className="font-medium">{g.with}</span>
          <select
            name="staffId"
            value={stylist}
            onChange={(e) => setStaffId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
          >
            <option value="">{g.anyone}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.title ? ` (${s.title})` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {liveDeals.length > 0 && (
        <label className="block text-sm">
          <span className="font-medium">{g.deal}</span>
          <select
            name="promotionId"
            defaultValue={liveDeals.some((p) => String(p.id) === urlDeal) ? urlDeal : ""}
            key={urlDeal}
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
          >
            <option value="">{g.noDeal}</option>
            {liveDeals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
                {p.price_label ? ` (${p.price_label})` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">
          <span className="font-medium">{t.booking.day}</span>
          <select
            name="date"
            value={date}
            required={instantOn}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
          >
            <option value="">{instantOn ? g.pickDay : t.booking.anyDay}</option>
            {dates.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">{t.booking.time}</span>
          <select
            name="time"
            disabled={!date || loadingSlots}
            required={instantOn}
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 disabled:bg-canvas"
          >
            {instantOn ? (
              <>
                <option value="">
                  {loadingSlots ? g.checking : date && instantSlots.length === 0 ? g.fullyBooked : g.pickTime}
                </option>
                {instantSlots.map((s) => (
                  <option key={s.time} value={s.time}>
                    {localTime(s.time, locale)}
                    {s.left === 1 && instant!.capacity > 1 ? ` (${g.lastSpot})` : ""}
                  </option>
                ))}
              </>
            ) : (
              <>
                <option value="">{date && requestSlots.length === 0 ? t.common.closed : t.booking.anyTime}</option>
                {requestSlots.map((slot) => (
                  <option key={slot} value={slot}>{localTime(slot, locale)}</option>
                ))}
              </>
            )}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium">{t.booking.yourName}</span>
        <input name="name" required maxLength={80} autoComplete="given-name" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" />
      </label>
      {instantOn && (
        <label className="block text-sm">
          <span className="font-medium">{g.phone}</span>
          <input
            name="phone"
            required
            type="tel"
            maxLength={20}
            autoComplete="tel"
            placeholder="012-345 6789"
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
          />
        </label>
      )}
      <label className="block text-sm">
        <span className="font-medium">{t.booking.note}</span>
        <input name="note" maxLength={300} placeholder={t.booking.notePlaceholder} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" />
      </label>
      <Turnstile />
      {state.error && <p role="alert" className="text-sm text-brand-700">{state.error}</p>}
      <button
        disabled={pending}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white hover:brightness-95 disabled:opacity-60 ${
          instantOn ? "bg-brand-600" : "bg-whatsapp"
        }`}
      >
        {instantOn ? (pending ? g.booking : g.bookThis) : pending ? t.booking.opening : t.booking.send}
      </button>
      <p className="text-xs text-muted">
        {instantOn ? g.instantNote : t.booking.disclaimer}
      </p>
    </form>
  );
}
