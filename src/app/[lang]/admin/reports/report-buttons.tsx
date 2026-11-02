"use client";

import { useTransition } from "react";
import { resolveReport, setListingStatus } from "@/app/admin/actions";

export function ReportButtons({ reportId, listingId, reason }: { reportId: number; listingId: string | null; reason: string }) {
  const [pending, start] = useTransition();
  const btn = "rounded-full border border-line px-3 py-1 disabled:opacity-50";
  return (
    <div className="flex flex-wrap gap-2">
      {listingId && (reason === "closed" || reason === "removal_request") && (
        <button
          disabled={pending}
          className="rounded-full bg-ink px-3 py-1 text-white disabled:opacity-50"
          onClick={() =>
            start(async () => {
              await setListingStatus(listingId, reason === "closed" ? "closed" : "archived");
              await resolveReport(reportId, "resolved");
            })
          }
        >
          {reason === "closed" ? "Mark closed" : "Remove listing"}
        </button>
      )}
      <button disabled={pending} className={btn} onClick={() => start(() => resolveReport(reportId, "resolved"))}>Resolved</button>
      <button disabled={pending} className={btn} onClick={() => start(() => resolveReport(reportId, "dismissed"))}>Dismiss</button>
    </div>
  );
}
