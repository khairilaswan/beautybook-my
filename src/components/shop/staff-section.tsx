import Image from "next/image";
import { Silhouette } from "@/components/silhouette";
import { photoUrl } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import type { StaffMember } from "@/lib/types";

export async function StaffSection({ staff, bookable }: { staff: StaffMember[]; bookable: boolean }) {
  const { t } = await getI18n();
  const g = t.growth.shop;
  return (
    <ul className="mt-3 grid gap-3 sm:grid-cols-2">
      {staff.map((s) => (
        <li key={s.id} className="flex gap-3 rounded-2xl border border-line bg-white p-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-brand-50">
            {s.photo_path ? (
              <Image src={photoUrl(s.photo_path)} alt={s.name} fill sizes="64px" className="object-cover" />
            ) : (
              <Silhouette />
            )}
          </div>
          <div className="min-w-0 text-sm">
            <p className="font-semibold">{s.name}</p>
            {s.title && <p className="text-muted">{s.title}</p>}
            {s.languages.length > 0 && <p className="text-xs text-muted">{fmt(g.speaks, { languages: s.languages.join(", ") })}</p>}
            {s.bio && <p className="mt-1">{s.bio}</p>}
            {bookable && (
              <a href={`?staff=${s.id}#book`} className="mt-2 inline-block text-brand-700 underline">
                {fmt(g.bookWith, { name: s.name.split(" ")[0] })}
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
