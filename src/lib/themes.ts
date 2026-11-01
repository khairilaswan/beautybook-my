// Site themes: a style (the look) plus a colour. The admin picks one for the
// whole site in /admin/theme. Style rules live in globals.css; the colour
// palettes below are turned into CSS by paletteCss() so the swatches and the
// site share one source.

export const STYLES = [
  {
    id: "classic",
    name: "Classic",
    blurb: "The original BeautyBook look: soft, rounded and simple.",
  },
  {
    id: "glass",
    name: "Glassmorphism",
    blurb: "Frosted see-through cards floating over a soft colour glow.",
  },
  {
    id: "brutal",
    name: "Neo-brutalism",
    blurb: "Bold black outlines, hard shadows and bright, punchy colour.",
  },
  {
    id: "minimal",
    name: "Minimalism",
    blurb: "Lots of white space, thin lines and quiet, light type.",
  },
  {
    id: "swiss",
    name: "Swiss style",
    blurb: "Strict grid, sharp corners, big tight headlines and one strong colour.",
  },
] as const;

export type ThemeStyle = (typeof STYLES)[number]["id"];

// 50 to 700, light to dark. 600 is the main button colour, so it keeps white
// text readable (4.5:1 or better).
type Scale = [string, string, string, string, string, string, string, string];

type Palette = {
  name: string;
  scale: Scale;
  // Second colour for two-colour combinations (glass only); defaults to scale.
  accent?: Scale;
};

const SCALES = {
  pink: ["#fdf2f6", "#fbe6ee", "#f8cddd", "#f3a5c2", "#ea6f9c", "#d9467a", "#c22c62", "#a2214f"],
  red: ["#fef2f2", "#fee2e2", "#fecaca", "#fca5a5", "#f87171", "#ef4444", "#dc2626", "#b91c1c"],
  orange: ["#fff7ed", "#ffedd5", "#fed7aa", "#fdba74", "#fb923c", "#f97316", "#c2410c", "#9a3412"],
  yellow: ["#fefce8", "#fef9c3", "#fef08a", "#fde047", "#facc15", "#eab308", "#a16207", "#854d0e"],
  green: ["#f0fdf4", "#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#22c55e", "#15803d", "#166534"],
  teal: ["#f0fdfa", "#ccfbf1", "#99f6e4", "#5eead4", "#2dd4bf", "#14b8a6", "#0f766e", "#115e59"],
  blue: ["#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8"],
  indigo: ["#eef2ff", "#e0e7ff", "#c7d2fe", "#a5b4fc", "#818cf8", "#6366f1", "#4f46e5", "#4338ca"],
  purple: ["#faf5ff", "#f3e8ff", "#e9d5ff", "#d8b4fe", "#c084fc", "#a855f7", "#9333ea", "#7e22ce"],
  black: ["#fafafa", "#f4f4f5", "#e4e4e7", "#d4d4d8", "#a1a1aa", "#52525b", "#18181b", "#000000"],
} satisfies Record<string, Scale>;

export const PALETTES = {
  pink: { name: "Pink", scale: SCALES.pink },
  red: { name: "Red", scale: SCALES.red },
  orange: { name: "Orange", scale: SCALES.orange },
  yellow: { name: "Yellow", scale: SCALES.yellow },
  green: { name: "Green", scale: SCALES.green },
  teal: { name: "Teal", scale: SCALES.teal },
  blue: { name: "Blue", scale: SCALES.blue },
  indigo: { name: "Indigo", scale: SCALES.indigo },
  purple: { name: "Purple", scale: SCALES.purple },
  black: { name: "Black", scale: SCALES.black },
  sunset: { name: "Sunset (orange + pink)", scale: SCALES.orange, accent: SCALES.pink },
  ocean: { name: "Ocean (blue + teal)", scale: SCALES.blue, accent: SCALES.teal },
  aurora: { name: "Aurora (green + purple)", scale: SCALES.green, accent: SCALES.purple },
  berry: { name: "Berry (purple + pink)", scale: SCALES.purple, accent: SCALES.pink },
} satisfies Record<string, Palette>;

export type ThemeColor = keyof typeof PALETTES;

const SOLIDS: ThemeColor[] = ["pink", "red", "orange", "yellow", "green", "teal", "blue", "indigo", "purple", "black"];

// The 10 colours each style offers.
export const STYLE_COLORS: Record<ThemeStyle, ThemeColor[]> = {
  classic: SOLIDS,
  glass: ["pink", "red", "blue", "green", "orange", "black", "sunset", "ocean", "aurora", "berry"],
  brutal: SOLIDS,
  minimal: SOLIDS,
  swiss: SOLIDS,
};

export type SiteTheme = { style: ThemeStyle; color: ThemeColor };

export const DEFAULT_THEME: SiteTheme = { style: "classic", color: "pink" };

// Ready-made combinations to start from.
export const TEMPLATES: { id: string; name: string; theme: SiteTheme; blurb: string }[] = [
  { id: "rose-glass", name: "Rose Glass", theme: { style: "glass", color: "pink" }, blurb: "Soft and dreamy, made for nail and beauty studios." },
  { id: "ocean-glass", name: "Ocean Glass", theme: { style: "glass", color: "ocean" }, blurb: "Cool blue to teal glow, calm spa feel." },
  { id: "sunset-glass", name: "Sunset Glass", theme: { style: "glass", color: "sunset" }, blurb: "Warm orange into pink, friendly and lively." },
  { id: "pop-brutal", name: "Pop Bold", theme: { style: "brutal", color: "yellow" }, blurb: "Loud and fun, stands out on social media." },
  { id: "barber-brutal", name: "Barber Block", theme: { style: "brutal", color: "red" }, blurb: "Barbershop red with heavy outlines." },
  { id: "clean-minimal", name: "Clean Studio", theme: { style: "minimal", color: "black" }, blurb: "Black and white, premium salon feel." },
  { id: "sage-minimal", name: "Sage Calm", theme: { style: "minimal", color: "teal" }, blurb: "Quiet teal accent, wellness and spa." },
  { id: "swiss-red", name: "Swiss Red", theme: { style: "swiss", color: "red" }, blurb: "Sharp, confident and very easy to read." },
  { id: "swiss-blue", name: "Swiss Blue", theme: { style: "swiss", color: "blue" }, blurb: "Trustworthy blue on a strict grid." },
  { id: "classic-pink", name: "Classic", theme: DEFAULT_THEME, blurb: "The current BeautyBook look." },
];

export function isThemeStyle(v: unknown): v is ThemeStyle {
  return STYLES.some((s) => s.id === v);
}

// Any stored or requested value becomes a valid theme: an unknown style falls
// back to classic and a colour the style doesn't offer to its first colour.
export function normalizeTheme(style: unknown, color: unknown): SiteTheme {
  const s = isThemeStyle(style) ? style : DEFAULT_THEME.style;
  const colors = STYLE_COLORS[s];
  const c = colors.includes(color as ThemeColor) ? (color as ThemeColor) : colors[0];
  return { style: s, color: c };
}

export function themeLabel(theme: SiteTheme): string {
  const style = STYLES.find((s) => s.id === theme.style)!;
  return `${style.name}, ${PALETTES[theme.color].name}`;
}

// Main colour, used for the browser bar.
export function themeColorHex(theme: SiteTheme): string {
  return PALETTES[theme.color].scale[6];
}

// One rule per colour, setting --p-50..--p-700 (and --a-* for the accent).
export function paletteCss(): string {
  const steps = [50, 100, 200, 300, 400, 500, 600, 700];
  return Object.entries(PALETTES)
    .map(([id, p]: [string, Palette]) => {
      const accent = p.accent ?? p.scale;
      const vars = [
        ...p.scale.map((hex, i) => `--p-${steps[i]}:${hex}`),
        ...accent.map((hex, i) => `--a-${steps[i]}:${hex}`),
        // The bright fill neo-brutalism buttons use, and the text on it.
        `--p-bright:${id === "black" ? p.scale[6] : p.scale[4]}`,
        `--p-on-bright:${id === "black" ? "#fff" : "#000"}`,
      ];
      return `[data-color="${id}"]{${vars.join(";")}}`;
    })
    .join("\n");
}
