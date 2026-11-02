import { HTML_LANG, type Locale } from "@/lib/i18n/config";
import type { Area, Attribute, Category, Service } from "@/lib/types";

// Names stored in the database, shown in the visitor's language. Safe on
// server and client.

export function categoryName(c: Pick<Category, "name_en" | "name_ms" | "name_zh">, locale: Locale): string {
  if (locale === "ms") return c.name_ms || c.name_en;
  if (locale === "zh") return c.name_zh || c.name_en;
  return c.name_en;
}

// attributes has no name_zh column; the Chinese names live here by slug.
const ATTRIBUTE_ZH: Record<string, string> = {
  "muslimah-friendly": "穆斯林女性友好",
  "female-stylists": "女性造型师",
  "private-room": "私人房间",
  "kids-friendly": "欢迎儿童",
  "speaks-malay": "马来语",
  "speaks-english": "英语",
  "speaks-chinese": "华语",
  "speaks-tamil": "淡米尔语",
  "halal-products": "清真产品",
  parking: "停车位",
  "wheelchair-access": "轮椅通道",
  "home-service": "上门服务",
  "walk-in": "欢迎直接上门",
  "appointment-only": "仅限预约",
};

export function attributeName(a: Pick<Attribute, "slug" | "name_en" | "name_ms">, locale: Locale): string {
  if (locale === "ms") return a.name_ms || a.name_en;
  if (locale === "zh") return ATTRIBUTE_ZH[a.slug] ?? a.name_en;
  return a.name_en;
}

// Place names are the same in English and Malay. Malaysian Chinese use their
// own names for most towns; only well-established ones are listed, the rest
// keep the official name.
const AREA_ZH: Record<string, string> = {
  "kuala-lumpur": "吉隆坡",
  selangor: "雪兰莪",
  putrajaya: "布城",
  "petaling-jaya": "八打灵再也",
  "subang-jaya": "梳邦再也",
  "shah-alam": "莎阿南",
  klang: "巴生",
  puchong: "蒲种",
  ampang: "安邦",
  kajang: "加影",
  bangi: "万宜",
  "seri-kembangan": "史里肯南安",
  cyberjaya: "赛城",
  selayang: "士拉央",
  "sungai-buloh": "双溪毛糯",
  rawang: "万挠",
  bangsar: "孟沙",
  "mont-kiara": "满家乐",
  "bukit-bintang": "武吉免登",
  cheras: "蕉赖",
  kepong: "甲洞",
  setapak: "文良港",
  "sri-petaling": "大城堡",
  "bukit-jalil": "武吉加里尔",
  brickfields: "十五碑",
  sentul: "冼都",
  ttdi: "敦依斯迈花园",
  "kuchai-lama": "旧古冶",
  "old-klang-road": "旧巴生路",
  "damansara-jaya": "白沙罗再也",
  "bandar-utama": "万达镇",
  "kota-damansara": "哥打白沙罗",
  "kelana-jaya": "格拉那再也",
};

export function areaName(a: Pick<Area, "slug" | "name">, locale: Locale): string {
  return (locale === "zh" && AREA_ZH[a.slug]) || a.name;
}

export function serviceName(s: Pick<Service, "name" | "name_ms">, locale: Locale): string {
  return (locale === "ms" && s.name_ms) || s.name;
}

const TZ = "Asia/Kuala_Lumpur";

// 0 = Sunday. "Monday", "Isnin", "星期一".
export function weekdayName(weekday: number, locale: Locale, style: "long" | "short" = "long"): string {
  // 2026-11-01 was a Sunday.
  const d = new Date(Date.UTC(2026, 10, 1 + weekday, 4));
  return new Intl.DateTimeFormat(HTML_LANG[locale], { weekday: style, timeZone: TZ }).format(d);
}

// "1:30 PM", "1:30 PTG", "下午1:30" from "13:30" or "13:30:00".
export function localTime(time: string, locale: Locale): string {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  if (locale === "en") {
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  }
  return new Intl.DateTimeFormat(HTML_LANG[locale], { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, 0, 1, h, m)),
  );
}

export function localDate(iso: string | Date, locale: Locale, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(HTML_LANG[locale], {
    timeZone: TZ,
    ...(Object.keys(options).length ? options : { day: "numeric", month: "short", year: "numeric" }),
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}
