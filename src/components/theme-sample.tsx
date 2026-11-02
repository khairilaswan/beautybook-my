import type { SiteTheme } from "@/lib/themes";

const CATEGORIES = [
  ["Hair salon", "Salun rambut"],
  ["Barbershop", "Kedai gunting"],
  ["Nail salon", "Salun kuku"],
  ["Facial & skin", "Rawatan muka"],
];
const SHOPS = [
  ["Kiara Hair Studio", "Hair salon · Mont Kiara", "Unisex", "RM 60 to 120"],
  ["Gentlemen's Corner", "Barbershop · Petaling Jaya", "Men", "RM 25 to 45"],
  ["Lacquer Nail Bar", "Nail salon · Bangsar", "Women", "RM 40 to 90"],
];

// A small copy of the home page, built from the same Tailwind classes as the
// real pages, so it shows exactly how a theme will look. Not interactive.
export function ThemeSample({ theme, className = "" }: { theme: SiteTheme; className?: string }) {
  return (
    <div data-style={theme.style} data-color={theme.color} inert className={`overflow-hidden text-left ${className}`}>
      <header className="border-b border-line bg-white/90 backdrop-blur">
        <div className="flex h-14 items-center gap-4 px-6">
          <span className="text-lg font-bold tracking-tight">
            Beauty<span className="text-brand-600">Book</span>
          </span>
          <nav className="ml-auto flex items-center gap-3 text-sm">
            <span className="rounded-full px-3 py-1.5">Explore</span>
            <span className="rounded-full px-3 py-1.5">For businesses</span>
            <span className="rounded-full bg-ink px-3 py-1.5 font-medium text-white">Sign in</span>
          </nav>
        </div>
      </header>

      <section className="theme-hero bg-gradient-to-b from-brand-50 to-canvas">
        <div className="px-6 pb-10 pt-12">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Find your next salon, barber or beauty spot in Klang Valley
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            See services and prices, then send a booking request on WhatsApp in seconds.
          </p>
          <div className="mt-8 grid max-w-3xl grid-cols-[1fr_1fr_auto] gap-2 rounded-2xl border border-line bg-white p-2 shadow-sm">
            <span className="rounded-xl px-3 py-3">Any service</span>
            <span className="rounded-xl px-3 py-3">All of Klang Valley</span>
            <span className="rounded-xl bg-brand-600 px-6 py-3 font-medium text-white">Search</span>
          </div>
        </div>
      </section>

      <section className="px-6 py-8">
        <h2 className="text-xl font-semibold">Browse by service</h2>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {CATEGORIES.map(([en, ms]) => (
            <a key={en} className="rounded-2xl border border-line bg-white p-4">
              <span className="font-medium">{en}</span>
              <span className="mt-0.5 block text-sm text-muted">{ms}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="px-6 pb-8">
        <h2 className="text-xl font-semibold">Popular near you</h2>
        <div className="mt-4 grid grid-cols-3 gap-4">
          {SHOPS.map(([name, meta, gender, price]) => (
            <a key={name} className="group overflow-hidden rounded-2xl border border-line bg-white">
              <div className="relative flex aspect-[16/9] items-center justify-center bg-brand-50 text-4xl font-bold text-brand-200">
                {name.slice(0, 1)}
                <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2 py-0.5 text-xs font-medium text-whatsapp">
                  Open now
                </span>
              </div>
              <div className="space-y-1 p-4">
                <h3 className="font-semibold leading-snug">{name}</h3>
                <p className="text-sm text-muted">{meta}</p>
                <p className="flex gap-2 text-xs text-muted">
                  <span>{gender}</span>
                  <span>{price}</span>
                  <span className="text-brand-700">Owner-managed</span>
                </p>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="px-6 pb-10">
        <div className="grid grid-cols-[2fr_1fr] items-center gap-6 rounded-3xl bg-ink p-8 text-white">
          <div>
            <h2 className="text-2xl font-semibold">Own a salon or barbershop?</h2>
            <p className="mt-2 text-white/75">Claim your free listing and see every booking request.</p>
          </div>
          <span className="justify-self-end rounded-full bg-white px-5 py-3 font-medium text-ink">
            Claim your business
          </span>
        </div>
      </section>
    </div>
  );
}
