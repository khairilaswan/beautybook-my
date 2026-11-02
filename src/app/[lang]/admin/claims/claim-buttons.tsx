"use client";

import { useState, useTransition } from "react";
import { reviewClaim } from "@/app/admin/actions";

export function ClaimButtons({ claimId }: { claimId: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  if (result) return <span className="text-muted">{result}</span>;
  const decide = (approve: boolean) =>
    start(async () => {
      const r = await reviewClaim(claimId, approve);
      setResult(r.error ?? r.message ?? null);
    });
  return (
    <div className="flex gap-2">
      <button disabled={pending} onClick={() => decide(true)} className="rounded-full bg-ink px-3 py-1 text-white disabled:opacity-50">Approve</button>
      <button disabled={pending} onClick={() => decide(false)} className="rounded-full border border-line px-3 py-1 disabled:opacity-50">Reject</button>
    </div>
  );
}
