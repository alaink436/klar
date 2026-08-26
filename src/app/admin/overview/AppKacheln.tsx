// Das Portfolio auf einen Blick. Apps, die in KLAR_ADMIN_APPS verdrahtet sind,
// fuehren auf ihre Affiliate-Seite; die uebrigen stehen gedaempft daneben, aber
// sie stehen da, denn das Studio soll immer den ganzen Bestand sehen, nicht nur den
// angeschlossenen Teil.
//
// `connected` wird gegen den BACKEND-Schluessel geprueft, nicht gegen die
// Marke: Anime Vault laeuft auf dem Projekt von promillio.

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LISTED_APPS, resolveBackendKey, type KlarAppMeta } from "@/lib/klarApps";

export function AppKacheln({ verdrahtet }: { verdrahtet: Set<string> }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2.5">
      {LISTED_APPS.map((a: KlarAppMeta) => {
        const backendSlug = resolveBackendKey(a, verdrahtet);
        const angeschlossen = verdrahtet.has(backendSlug);

        const inhalt = (
          <>
            <Badge variant={a.status === "LIVE" ? "success" : "neutral"} className="self-start">
              {a.status === "LIVE" ? "Live" : a.status}
            </Badge>
            <span className="mt-2.5 flex size-9 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-[var(--line)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.icon} alt="" width={36} height={36} className="size-full object-cover" loading="lazy" />
            </span>
            <span className="mt-2 text-[12.5px] font-semibold text-[var(--fg)]">{a.name}</span>
            <span className="[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.1em] text-[var(--fg-4)]">
              {angeschlossen ? "Affiliate" : "nicht verdrahtet"}
            </span>
          </>
        );

        const rahmen =
          "flex flex-col rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-3.5 no-underline";

        return angeschlossen ? (
          <Link
            key={a.name}
            href={`/admin?view=${backendSlug}`}
            className={`${rahmen} transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-2)]`}
          >
            {inhalt}
          </Link>
        ) : (
          <span key={a.name} className={`${rahmen} opacity-55`} title="Affiliate-Schema noch nicht verdrahtet">
            {inhalt}
          </span>
        );
      })}
    </div>
  );
}
