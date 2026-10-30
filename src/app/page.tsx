import Link from "next/link";
import { RecentSearches } from "@/components/recent-searches";
import { getAreas, getCategories } from "@/lib/data/directory";

export default async function HomePage() {
  const [categories, areas] = await Promise.all([getCategories(), getAreas()]);
  const cities = areas.filter((a) => a.type === "city");

  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-canvas">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-14 sm:pt-20">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Find your next salon, barber or beauty spot in Klang Valley
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            See services and prices, then send a booking request on WhatsApp in seconds.
          </p>
          <form
            action="/search"
            className="mt-8 grid max-w-3xl gap-2 rounded-2xl border border-line bg-white p-2 shadow-sm sm:grid-cols-[1fr_1fr_auto]"
          >
            <label className="sr-only" htmlFor="home-category">Service</label>
            <select id="home-category" name="category" className="rounded-xl px-3 py-3">
              <option value="">Any service</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name_en}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="home-area">Area</label>
            <select id="home-area" name="area" className="rounded-xl px-3 py-3">
              <option value="">All of Klang Valley</option>
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
            <button className="rounded-xl bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700">
              Search
            </button>
          </form>
          <div className="mt-6">
            <RecentSearches />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-xl font-semibold">Browse by service</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/search?category=${c.slug}`}
              className="rounded-2xl border border-line bg-white p-4 hover:border-brand-200 hover:shadow-sm"
            >
              <span className="font-medium">{c.name_en}</span>
              <span className="mt-0.5 block text-sm text-muted">{c.name_ms}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="text-xl font-semibold">Browse by area</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {cities.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/${c.slug}`}
                className="inline-block rounded-full border border-line bg-white px-4 py-2 text-sm hover:border-brand-200"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6 rounded-3xl bg-ink p-8 text-white sm:grid-cols-[2fr_1fr] sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold">Own a salon or barbershop?</h2>
            <p className="mt-2 text-white/75">
              Claim your free listing in about a minute, update your prices and hours, and see every
              booking request from BeautyBook.
            </p>
          </div>
          <Link
            href="/for-business"
            className="justify-self-start rounded-full bg-white px-5 py-3 font-medium text-ink hover:bg-brand-50 sm:justify-self-end"
          >
            Claim or add your business
          </Link>
        </div>
      </section>
    </>
  );
}
