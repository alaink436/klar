// Klar Control · Prüfliste.
//
// Posts von Creatorn ohne Link, die "Basalt" nennen, deren Bilder aber keine
// ihrer Fassungen sind, und die ueber 1000 Views haben (Spec creator-plattform,
// Ticket 04). Links die Bilder des Posts, rechts die naechste Fassung, die der
// Creator von uns hat. "Zaehlt" nimmt den Post auf, eine Ablehnung ist ein
// Verstoss (1 Verwarnung, 2 30 Tage Sperre, 3 Konto geschlossen), der Creator
// bekommt jedes Mal eine Mail. Geschrieben wird ueber /admin/pruefliste/save.

import { ClipboardCheck } from "lucide-react";
import { requireAdminPage } from "../../../lib/adminGuard";
import { REVIEW_VIEWS, listReviewQueue } from "../../../lib/postCheck";
import { AdminTopbar } from "../AdminTopbar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TextureCard } from "@/components/ui/texture-card";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const mono = { fontFamily: "var(--font-mono)", fontSize: 12.5 } as const;

function Bilder({ titel, srcs }: { titel: string; srcs: string[] }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[12px] text-fg-3">{titel}</p>
      {srcs.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {srcs.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- signed storage URLs, valid for an hour
            <img key={src} src={src} alt={`Bild ${i + 1}`} className="h-36 w-auto flex-none rounded-md" loading="lazy" />
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] text-fg-3">keine Bilder (Video oder nicht ladbar)</p>
      )}
    </div>
  );
}

export default async function PrueflistePage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const items = await listReviewQueue();

  return (
    <>
      <title>Prüfliste · Klar Control</title>
      <AdminTopbar titel="Prüfliste" />
      <div className="content">
        <PageHeader eyebrow="Klar Studios" icon={<ClipboardCheck />} title="Prüfliste">
          Posts von Creatorn ohne Link, die Basalt nennen, aber nicht wie eine ihrer Fassungen aussehen, ab {REVIEW_VIEWS} Views.
          Eine Ablehnung ist ein Verstoss: beim ersten eine Verwarnung, beim zweiten 30 Tage Sperre, beim dritten ist das Konto zu.
        </PageHeader>

        {sp.msg || sp.err ? (
          <TextureCard className="mb-4 px-5 py-3.5 text-[12.5px] text-fg-2">{sp.err ?? sp.msg}</TextureCard>
        ) : null}

        {items.length === 0 ? (
          <TextureCard className="p-5 text-[13px] text-fg-3">Nichts zu prüfen.</TextureCard>
        ) : (
          <div className="grid gap-4">
            {items.map((it) => (
              <TextureCard key={it.postId} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="m-0">@{it.handle}</h2>
                    <p className="mt-1 text-fg-3" style={mono}>
                      {it.views.toLocaleString("de-CH")} Views · {new Date(it.postedAt).toLocaleDateString("de-CH")} · erkannt {it.matched}
                      {it.url ? (
                        <>
                          {" · "}
                          <a href={it.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--fg)" }}>
                            auf TikTok
                          </a>
                        </>
                      ) : null}
                    </p>
                    {it.caption ? <p className="mt-2 max-w-[70ch] text-[13px] text-fg-2">{it.caption}</p> : null}
                  </div>
                  <form action="/admin/pruefliste/save" method="post" className="flex flex-wrap gap-2">
                    <input type="hidden" name="post" value={it.postId} />
                    <Button type="submit" name="decision" value="approve" variant="pill">
                      Zählt
                    </Button>
                    <Button type="submit" name="decision" value="own_content" variant="pill-dark" className="text-danger">
                      Ablehnen: eigener Inhalt
                    </Button>
                    <Button type="submit" name="decision" value="false_claims" variant="pill-dark" className="text-danger">
                      Ablehnen: falsche Versprechen
                    </Button>
                  </form>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Bilder titel="Sein Post" srcs={it.postImages} />
                  <Bilder titel="Nächste Fassung von uns" srcs={it.ourSlides} />
                </div>
              </TextureCard>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
