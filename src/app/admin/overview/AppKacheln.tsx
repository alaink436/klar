// Das Portfolio auf einen Blick: jede gelistete App mit Status, Symbol und
// Name.

import { Badge } from "@/components/ui/badge";
import { LISTED_APPS, type KlarAppMeta } from "@/lib/klarApps";

export function AppKacheln() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2.5">
      {LISTED_APPS.map((a: KlarAppMeta) => (
        <span
          key={a.name}
          className="flex flex-col rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-3.5 no-underline"
        >
          <Badge variant={a.status === "LIVE" ? "success" : "neutral"} className="self-start">
            {a.status === "LIVE" ? "Live" : a.status}
          </Badge>
          <span className="mt-2.5 flex size-9 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-[var(--line)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.icon} alt="" width={36} height={36} className="size-full object-cover" loading="lazy" />
          </span>
          <span className="mt-2 text-[12.5px] font-semibold text-[var(--fg)]">{a.name}</span>
        </span>
      ))}
    </div>
  );
}
