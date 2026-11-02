import type { HubStats } from "@/lib/data/directory";
import type { Locale } from "@/lib/i18n/config";
import { areaName, categoryName, localDate } from "@/lib/i18n/names";
import type { Area, Category } from "@/lib/types";

const rm = (n: number) => `RM${Number.isInteger(n) ? n : n.toFixed(2)}`;

type Facts = {
  area: string;
  count: number;
  // "barbershops", "kedai gunting rambut", "理发店"; one/many for English.
  nounOne: string;
  nounMany: string;
  // The plural used in questions: "salons, barbers and beauty shops".
  what: string;
  min: string | null;
  max: string | null;
  priced: number;
  lateCount: number;
  checked: string | null;
};

function englishNoun(category: Category | null, count: number): string {
  const name = category ? category.name_en.toLowerCase() : "beauty shop";
  if (count === 1) return name;
  if (name.endsWith("s")) return name;
  if (name.includes("&")) return `${name} shops`;
  return `${name}s`;
}

// Hub copy per language. Grammar differs too much for one template with
// placeholders, so each language builds its own sentences from the facts.
const COPY: Record<
  Locale,
  {
    summary: (f: Facts) => string;
    faqs: (f: Facts) => { question: string; answer: string }[];
  }
> = {
  en: {
    summary: (f) => {
      const parts = [`${f.count} ${f.count === 1 ? f.nounOne : f.nounMany} in ${f.area}`];
      if (f.min && f.max) parts.push(`prices from ${f.min} to ${f.max}`);
      if (f.checked) parts.push(`last checked ${f.checked}`);
      return `${parts.join("; ")}.`;
    },
    faqs: (f) => [
      {
        question: `How many ${f.what} are there in ${f.area}?`,
        answer: `BeautyBook lists ${f.count} ${f.count === 1 ? f.nounOne : f.nounMany} in ${f.area}${
          f.checked ? `, last checked in ${f.checked}` : ""
        }.`,
      },
      ...(f.min && f.max
        ? [
            {
              question: `How much does it cost in ${f.area}?`,
              answer: `Across ${f.priced} shops that list prices, services range from ${f.min} to ${f.max}. Each shop page shows its own menu.`,
            },
          ]
        : []),
      ...(f.lateCount > 0
        ? [
            {
              question: `Which ${f.what} in ${f.area} are open late?`,
              answer: `${f.lateCount} of them ${f.lateCount === 1 ? "is" : "are"} open until 9 PM or later on at least one day. Use the "Open now" filter to see who is open right now.`,
            },
          ]
        : []),
      {
        question: "How do I book?",
        answer:
          "Pick a service and a preferred time on the shop's page, then send the request on WhatsApp. The shop replies to confirm.",
      },
    ],
  },
  ms: {
    summary: (f) => {
      const parts = [`${f.count} ${f.nounMany} di ${f.area}`];
      if (f.min && f.max) parts.push(`harga dari ${f.min} hingga ${f.max}`);
      if (f.checked) parts.push(`kali terakhir disemak ${f.checked}`);
      return `${parts.join("; ")}.`;
    },
    faqs: (f) => [
      {
        question: `Berapa banyak ${f.what} di ${f.area}?`,
        answer: `BeautyBook menyenaraikan ${f.count} ${f.nounMany} di ${f.area}${
          f.checked ? `, kali terakhir disemak pada ${f.checked}` : ""
        }.`,
      },
      ...(f.min && f.max
        ? [
            {
              question: `Berapakah harganya di ${f.area}?`,
              answer: `Bagi ${f.priced} kedai yang menyenaraikan harga, servis berharga antara ${f.min} hingga ${f.max}. Setiap halaman kedai menunjukkan menunya sendiri.`,
            },
          ]
        : []),
      ...(f.lateCount > 0
        ? [
            {
              question: `${capitalise(f.what)} manakah di ${f.area} yang buka lewat malam?`,
              answer: `${f.lateCount} daripadanya buka sehingga 9 malam atau lebih lewat sekurang-kurangnya sehari seminggu. Gunakan penapis "Buka sekarang" untuk melihat siapa yang buka sekarang.`,
            },
          ]
        : []),
      {
        question: "Bagaimana cara untuk menempah?",
        answer:
          "Pilih servis dan masa pilihan anda di halaman kedai, kemudian hantar permintaan melalui WhatsApp. Kedai akan membalas untuk mengesahkan.",
      },
    ],
  },
  zh: {
    summary: (f) => {
      const parts = [`${f.area}共有 ${f.count} 家${f.nounMany}`];
      if (f.min && f.max) parts.push(`价格从 ${f.min} 到 ${f.max}`);
      if (f.checked) parts.push(`最后核实于 ${f.checked}`);
      return `${parts.join("；")}。`;
    },
    faqs: (f) => [
      {
        question: `${f.area}有多少家${f.what}？`,
        answer: `BeautyBook 收录了${f.area}的 ${f.count} 家${f.nounMany}${f.checked ? `，最后核实于 ${f.checked}` : ""}。`,
      },
      ...(f.min && f.max
        ? [
            {
              question: `在${f.area}大概需要多少钱？`,
              answer: `在列出价格的 ${f.priced} 家店中，服务价格从 ${f.min} 到 ${f.max} 不等。每家店的页面都有各自的价目表。`,
            },
          ]
        : []),
      ...(f.lateCount > 0
        ? [
            {
              question: `${f.area}有哪些${f.what}营业到很晚？`,
              answer: `其中 ${f.lateCount} 家每周至少有一天营业到晚上 9 点或更晚。使用“现在营业”筛选即可查看此刻营业的店。`,
            },
          ]
        : []),
      {
        question: "怎么预约？",
        answer: "在店铺页面选择服务和希望的时间，然后通过 WhatsApp 发送预约请求。店家会回复确认。",
      },
    ],
  },
};

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function facts(area: Area, category: Category | null, stats: HubStats, locale: Locale): Facts {
  const priced = stats.min_price !== null && stats.max_price !== null && stats.priced_count >= 3;
  const localNoun = category ? categoryName(category, locale) : null;
  const generic = { ms: "kedai kecantikan", zh: "美容店" } as const;
  const what = {
    en: category ? englishNoun(category, 2) : "salons, barbers and beauty shops",
    ms: localNoun ? localNoun.toLowerCase() : "salon, kedai gunting rambut dan kedai kecantikan",
    zh: localNoun ?? "发廊、理发店和美容店",
  }[locale];
  return {
    area: areaName(area, locale),
    count: stats.listing_count,
    nounOne: locale === "en" ? englishNoun(category, 1) : (localNoun?.toLowerCase() ?? generic[locale]),
    nounMany:
      locale === "en"
        ? englishNoun(category, stats.listing_count)
        : locale === "ms"
          ? (localNoun?.toLowerCase() ?? generic.ms)
          : (localNoun ?? generic.zh),
    what,
    min: priced ? rm(stats.min_price!) : null,
    max: priced ? rm(stats.max_price!) : null,
    priced: stats.priced_count,
    lateCount: stats.open_late_count,
    checked: stats.last_verified_at ? localDate(stats.last_verified_at, locale, { month: "short", year: "numeric" }) : null,
  };
}

// The answer-first line at the top of a hub page. Only states facts that
// come from our own data, so AI answers that quote it stay correct.
export function hubSummary(area: Area, category: Category | null, stats: HubStats, locale: Locale = "en"): string {
  return COPY[locale].summary(facts(area, category, stats, locale));
}

export function hubFaqs(area: Area, category: Category | null, stats: HubStats, locale: Locale = "en") {
  return COPY[locale].faqs(facts(area, category, stats, locale));
}
