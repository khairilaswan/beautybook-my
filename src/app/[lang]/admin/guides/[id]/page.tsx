import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GuideForm } from "@/app/[lang]/admin/guides/guide-form";
import { requirePermission } from "@/lib/auth";
import { getAreas, getCategories } from "@/lib/data/directory";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit guide" };

export default function Page({ params, searchParams }: PageProps<"/[lang]/admin/guides/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Editor params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Editor({
  params,
  searchParams,
}: {
  params: PageProps<"/[lang]/admin/guides/[id]">["params"];
  searchParams: PageProps<"/[lang]/admin/guides/[id]">["searchParams"];
}) {
  await requirePermission("seo.edit");
  const { id } = await params;
  const { saved } = await searchParams;
  const [areas, categories] = await Promise.all([getAreas(), getCategories()]);
  if (id === "new") {
    return (
      <>
        <h1 className="text-2xl font-bold">New guide</h1>
        <GuideForm areas={areas} categories={categories} guide={null} />
      </>
    );
  }
  if (!/^\d+$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: guide } = await supabase
    .from("guides")
    .select("id, slug, title, summary, body, area_id, category_id, faqs, status")
    .eq("id", Number(id))
    .maybeSingle();
  if (!guide) notFound();
  return (
    <>
      <h1 className="text-2xl font-bold">Edit guide</h1>
      {saved && <p className="mt-2 text-sm text-whatsapp">Saved.</p>}
      <GuideForm areas={areas} categories={categories} guide={guide} />
    </>
  );
}
