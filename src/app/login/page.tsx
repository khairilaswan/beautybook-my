import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForms } from "@/app/login/login-forms";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold">Sign in to BeautyBook</h1>
      <p className="mt-1 text-muted">Save shops, keep notes and see your booking requests.</p>
      <div className="mt-8">
        <Suspense>
          <Forms searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Forms({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const error = typeof params.error === "string" ? params.error : null;
  return (
    <>
      {error && <p role="alert" className="mb-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">{error}</p>}
      <LoginForms next={next} />
    </>
  );
}
