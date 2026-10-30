"use client";

import { useTransition } from "react";
import { setRequestStatus } from "@/app/owner/actions";

type Status = "confirmed" | "declined" | "completed" | "no_show";

const ACTIONS: Record<string, { status: Status; label: string }[]> = {
  sent: [
    { status: "confirmed", label: "Confirm" },
    { status: "declined", label: "Decline" },
  ],
  confirmed: [
    { status: "completed", label: "Completed" },
    { status: "no_show", label: "No-show" },
  ],
};

export function RequestStatusButtons({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const actions = ACTIONS[status] ?? [];
  if (actions.length === 0) return null;
  return (
    <div className="flex gap-2">
      {actions.map((a, i) => (
        <button
          key={a.status}
          disabled={pending}
          onClick={() => start(() => setRequestStatus(id, a.status))}
          className={`rounded-full px-3 py-1 text-sm disabled:opacity-50 ${
            i === 0 ? "bg-ink text-white" : "border border-line bg-white"
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
