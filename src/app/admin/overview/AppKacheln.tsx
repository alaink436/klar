// Das Portfolio auf einen Blick: jede gelistete App mit Status, Symbol und
// Name.

import { Badge } from "@/components/ui/badge";
import { TextureCard } from "@/components/ui/texture-card";
import { LISTED_APPS, type KlarAppMeta } from "@/lib/klarApps";

export function AppKacheln() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
      {LISTED_APPS.map((a: KlarAppMeta) => (
        <TextureCard key={a.name} className="flex flex-col p-4">
          <span className="klar-kachel size-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.icon} alt="" width={40} height={40} className="size-full object-cover" loading="lazy" />
          </span>
          <span className="mt-3 truncate text-[13.5px] font-medium text-[var(--fg)]">{a.name}</span>
          <Badge variant={a.status === "LIVE" ? "success" : "neutral"} dot className="mt-2 self-start">
            {a.status === "LIVE" ? "Live" : a.status}
          </Badge>
        </TextureCard>
      ))}
    </div>
  );
}
