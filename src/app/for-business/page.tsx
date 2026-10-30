import type { Metadata } from "next";
import Link from "next/link";
import { AddBusinessForm } from "@/app/for-business/add-business-form";
import { getAreas, getCategories } from "@/lib/data/directory";

export const metadata: Metadata = {
  title: "List or claim your salon, barbershop or beauty business",
  description:
    "Claim your free BeautyBook listing in about a minute. Update your menu, prices, hours and photos, and receive booking requests on WhatsApp.",
  alternates: { canonical: "/for-business" },
};

export default async function ForBusinessPage() {
  const [categories, areas] = await Promise.all([getCategories(), getAreas()]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
        Get booking requests on WhatsApp, free
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Customers find you on BeautyBook, pick a service and time, and message you on WhatsApp. Claim your listing to
        keep your menu, prices and hours up to date and see every enquiry.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-xl font-semibold">Already listed?</h2>
          <p className="mt-1 text-muted">Search for your shop and tap “Claim this business”.</p>
          <form action="/search" className="mt-4 flex gap-2">
            <input name="q" required placeholder="Your shop name" className="w-full rounded-xl border border-line px-3 py-2" />
            <button className="rounded-xl bg-ink px-4 py-2 font-medium text-white">Find</button>
          </form>
          <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm">
            <li>Sign in with Google, Facebook or your phone.</li>
            <li>We send a 6-digit code to your shop&apos;s WhatsApp number.</li>
            <li>Enter it and your dashboard opens. No paperwork.</li>
          </ol>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-xl font-semibold">Not listed yet? Add your business</h2>
          <p className="mt-1 text-muted">It goes live as soon as you verify your WhatsApp number.</p>
          <AddBusinessForm
            categories={categories.map((c) => ({ slug: c.slug, name: c.name_en }))}
            areas={areas.filter((a) => a.type !== "state").map((a) => ({ slug: a.slug, name: a.name }))}
          />
        </section>
      </div>

      <p className="mt-10 text-sm text-muted">
        Want your listing removed instead? See <Link href="/privacy#removal" className="underline">how removal works</Link>.
      </p>
    </div>
  );
}
