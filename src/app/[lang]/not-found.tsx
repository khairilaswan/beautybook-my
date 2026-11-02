import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted">The shop or page you&apos;re looking for isn&apos;t here.</p>
      <Link href="/search" className="mt-6 inline-block rounded-full bg-ink px-5 py-3 font-medium text-white">
        Explore shops
      </Link>
    </div>
  );
}
