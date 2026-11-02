import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t, href } = await getI18n();
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">{t.notFound.title}</h1>
      <p className="mt-2 text-muted">{t.notFound.body}</p>
      <Link href={href("/search")} className="mt-6 inline-block rounded-full bg-ink px-5 py-3 font-medium text-white">
        {t.notFound.cta}
      </Link>
    </div>
  );
}
