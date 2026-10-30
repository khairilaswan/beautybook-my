import type { HubStats } from "@/lib/data/directory";
import type { Area, Category } from "@/lib/types";

const monthYear = (iso: string) =>
  new Intl.DateTimeFormat("en-MY", { month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" }).format(
    new Date(iso),
  );

const rm = (n: number) => `RM${Number.isInteger(n) ? n : n.toFixed(2)}`;

function noun(category: Category | null, count: number): string {
  const name = category ? category.name_en.toLowerCase() : "beauty shop";
  if (count === 1) return name;
  if (name.endsWith("s")) return name;
  if (name.includes("&")) return `${name} shops`;
  return `${name}s`;
}

// The answer-first line at the top of a hub page. Only states facts that
// come from our own data, so AI answers that quote it stay correct.
export function hubSummary(area: Area, category: Category | null, stats: HubStats): string {
  const parts = [`${stats.listing_count} ${noun(category, stats.listing_count)} in ${area.name}`];
  if (stats.min_price !== null && stats.max_price !== null && stats.priced_count >= 3) {
    parts.push(`prices from ${rm(stats.min_price)} to ${rm(stats.max_price)}`);
  }
  if (stats.last_verified_at) {
    parts.push(`last checked ${monthYear(stats.last_verified_at)}`);
  }
  return `${parts.join("; ")}.`;
}

export function hubFaqs(area: Area, category: Category | null, stats: HubStats) {
  const what = category ? noun(category, 2) : "salons, barbers and beauty shops";
  const faqs = [
    {
      question: `How many ${what} are there in ${area.name}?`,
      answer: `BeautyBook lists ${stats.listing_count} ${noun(category, stats.listing_count)} in ${area.name}${
        stats.last_verified_at ? `, last checked in ${monthYear(stats.last_verified_at)}` : ""
      }.`,
    },
  ];
  if (stats.min_price !== null && stats.max_price !== null && stats.priced_count >= 3) {
    faqs.push({
      question: `How much does it cost in ${area.name}?`,
      answer: `Across ${stats.priced_count} shops that list prices, services range from ${rm(stats.min_price)} to ${rm(
        stats.max_price,
      )}. Each shop page shows its own menu.`,
    });
  }
  if (stats.open_late_count > 0) {
    faqs.push({
      question: `Which ${what} in ${area.name} are open late?`,
      answer: `${stats.open_late_count} of them ${stats.open_late_count === 1 ? "is" : "are"} open until 9 PM or later on at least one day. Use the "Open now" filter to see who is open right now.`,
    });
  }
  faqs.push({
    question: `How do I book?`,
    answer: `Pick a service and a preferred time on the shop's page, then send the request on WhatsApp. The shop replies to confirm.`,
  });
  return faqs;
}
