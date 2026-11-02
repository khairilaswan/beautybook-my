"use client";

import { useState, useTransition } from "react";
import { setMemberAccess } from "@/app/[lang]/admin/actions";
import type { AccessStatus } from "@/lib/site-access";

export function MemberActions({ userId, status }: { userId: string; status: AccessStatus }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const set = (next: "approved" | "rejected") =>
    start(async () => {
      const result = await setMemberAccess(userId, next);
      setMessage(result.error ?? result.message ?? null);
    });
  return (
    <span className="flex items-center gap-2">
      {status !== "approved" && (
        <button disabled={pending} onClick={() => set("approved")} className="rounded-full bg-ink px-3 py-1 text-white disabled:opacity-50">
          Approve
        </button>
      )}
      {status !== "rejected" && (
        <button disabled={pending} onClick={() => set("rejected")} className="rounded-full border border-line px-3 py-1 disabled:opacity-50">
          {status === "approved" ? "Remove access" : "Reject"}
        </button>
      )}
      {message && <span className="text-muted">{message}</span>}
    </span>
  );
}
