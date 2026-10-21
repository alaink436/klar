// Klar Control · Formate.
//
// Die Slideshows, die Creator im Kit bekommen (Spec creator-plattform, Ticket 03).
// Hoechstens 5 sind an; was Alain ausschaltet, verschwindet sofort aus jedem Kit.
// Je Format eine Vorschau (eine Fassung), der Vorrat an fertigen Fassungen, wie
// viele schon vergeben sind und wie viele ueberhaupt verschieden aussehen koennen.
// Neue Fassungen rendert die Routine im Vault: Projects/Klar/creator-kit/refill.ps1.
// Seit Ticket 05 je Format die Views nach 3 Tagen bei den Creatorn und die
// Markierung "müde" (src/lib/formatStats.ts), nur als Hinweis.
// Geschrieben wird ueber /admin/formate/save, gelesen ueber src/lib/creatorKit.ts.

import { Clapperboard } from "lucide-react";
import { requireAdminPage } from "../../../lib/adminGuard";
import { MAX_ACTIVE, listFormats } from "../../../lib/creatorKit";
import { formatStats } from "../../../lib/formatStats";
import { AdminTopbar } from "../AdminTopbar";
import { Kennzahlen } from "../Kennzahlen";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TextureCard } from "@/components/ui/texture-card";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const mono = { fontFamily: "var(--font-mono)", fontSize: 12.5 } as const;

function Marke({ an }: { an: boolean }) {
  return (
    <span className="klar-marke">
      <span className="klar-punkt" style={{ background: an ? "var(--success)" : "var(--fg-3)" }} aria-hidden="true" />
      {an ? "an" : "aus"}
    </span>
  );
}

export default async function FormatePage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const [formats, stats] = await Promise.all([listFormats(), formatStats()]);
  const statOf = new Map(stats.formats.map((s) => [s.formatId, s]));
  const views = (n: number | null) => (n === null ? "-" : Math.round(n).toLocaleString("de-CH"));
  const aktiv = formats.filter((f) => f.active);
  const knapp = aktiv.filter((f) => f.pool < 2);

  return (
    <>
      <title>Formate · Klar Control</title>
      <AdminTopbar titel="Formate" />
      <div className="content">
        <PageHeader eyebrow="Klar Studios" icon={<Clapperboard />} title="Formate">
          Die Slideshows im Kit der Creator. Höchstens {MAX_ACTIVE} sind an, jeder Creator bekommt pro Format eine eigene Fassung
          (anderer Hook, andere Reihenfolge, anderer Ton), damit TikTok keine Duplikate sieht.
        </PageHeader>

        <Kennzahlen
          zahlen={[
            { label: "An", wert: aktiv.length, zusatz: `von höchstens ${MAX_ACTIVE}` },
            { label: "Vergeben", wert: formats.reduce((n, f) => n + f.assigned, 0), zusatz: "Fassungen bei Creatorn" },
            {
              label: "Vorrat knapp",
              wert: knapp.length,
              zusatz: knapp.length ? "Routine laufen lassen: refill.ps1" : "jedes aktive Format hat Fassungen bereit",
            },
            {
              label: "Unsere Konten",
              wert: views(stats.own.viewsPerPost),
              zusatz: `Views nach 3 Tagen je Post, ${stats.own.posts} Posts der letzten Woche`,
            },
          ]}
        />

        {sp.msg || sp.err ? (
          <TextureCard className="mb-4 px-5 py-3.5 text-[12.5px] text-fg-2">{sp.err ?? sp.msg}</TextureCard>
        ) : null}

        <div className="grid gap-4">
          {formats.map((f) => (
            <TextureCard key={f.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="m-0">{f.name}</h2>
                    <Marke an={f.active} />
                    {statOf.get(f.id)?.tired ? (
                      <span className="klar-marke">
                        <span className="klar-punkt" style={{ background: "var(--warning)" }} aria-hidden="true" />
                        müde
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[12.5px] text-fg-3" style={mono}>
                    {f.id} · Vorrat {f.pool} · vergeben {f.assigned} · {f.looks.toLocaleString("de-CH")} mögliche Fassungen
                  </p>
                  <p className="mt-1 text-[12.5px] text-fg-3">
                    Creator: {views(statOf.get(f.id)?.viewsPerPost ?? null)} Views nach 3 Tagen je Post ({statOf.get(f.id)?.posts ?? 0} Posts)
                  </p>
                  <p className="mt-2 text-[13px] text-fg-2">{f.caption}</p>
                </div>
                <form action="/admin/formate/save" method="post">
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="active" value={f.active ? "0" : "1"} />
                  <Button type="submit" variant={f.active ? "pill-dark" : "pill"}>
                    {f.active ? "Ausschalten" : "Einschalten"}
                  </Button>
                </form>
              </div>
              {f.preview.length > 0 ? (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {f.preview.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element -- signed storage URLs, valid for an hour
                    <img key={src} src={src} alt={`Slide ${i + 1}`} className="h-40 w-auto flex-none rounded-md" loading="lazy" />
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[13px] text-fg-3">Noch keine Fassung gerendert. Routine laufen lassen: refill.ps1.</p>
              )}
            </TextureCard>
          ))}
        </div>
      </div>
    </>
  );
}
