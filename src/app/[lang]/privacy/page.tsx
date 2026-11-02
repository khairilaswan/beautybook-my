import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy and PDPA",
  description: "How BeautyBook handles personal data under Malaysia's Personal Data Protection Act, and how to remove a listing.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 px-4 py-10 leading-relaxed">
      <h1 className="text-3xl font-bold">Privacy and PDPA</h1>
      <p className="rounded-xl bg-brand-50 p-3 text-sm">
        Draft for review. Have this page checked by a lawyer before launch.
      </p>
      <section>
        <h2 className="text-xl font-semibold">What we collect</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Business listings: shop name, address, business phone, hours, services and photos the shop publishes itself.</li>
          <li>Accounts: your name, email or phone number from the sign-in method you choose.</li>
          <li>Booking requests: your name, the service and time you asked for, and an optional note. The message itself is sent from your own WhatsApp.</li>
          <li>Your saved shops, private notes and search history, which only you can see.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-semibold">How we use it</h2>
        <p className="mt-2">To show the directory, pass booking requests to shops, let owners manage their listing, and keep the site safe from spam. We don&apos;t sell personal data.</p>
      </section>
      <section id="removal">
        <h2 className="text-xl font-semibold">Remove or correct a listing</h2>
        <p className="mt-2">
          Business owners can ask us to remove or correct their listing at any time. Open the listing and choose
          “Report a problem”, then pick “Remove this listing”. We act on removal requests within 7 days.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Your account</h2>
        <p className="mt-2">
          You can see and change your details on <Link href="/account" className="underline">your account page</Link>. To
          delete your account, contact us and we&apos;ll remove it and your notes, favourites and history.
        </p>
      </section>
    </article>
  );
}
