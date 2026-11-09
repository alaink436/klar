// Klar Control · Routinen.
//
// The four daily TikTok post routines (Learnbound, Pocketmate, Basalt, Kelva), migrations/0056. Per routine: on or
// off, its posting times as chips (each click saves; the number of chips that are on is the frequency), the daily
// Higgsfield budget, and every post it scheduled with its views after 24 hours and after 3 days, as Apify read them.
// The cloud routines read these settings through GET /api/routines at the start of each run (Alain 2026-11-09:
// "dass ich dann die Frequenz dort auch gleich mit einstellen kann ... dass man immer sieht welcher Post gut
// performt hat"). Written through /admin/routinen/save, read through src/lib/routines.ts.

import { CalendarClock } from "lucide-react";
import { requireAdminPage } from "../../../lib/adminGuard";
import { SLOT_CHOICES, listRoutines, routinePosts, trackedHandles, type RoutinePostView } from "../../../lib/routines";
import { AdminTopbar } from "../AdminTopbar";
import { Kennzahlen } from "../Kennzahlen";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TextureCard } from "@/components/ui/texture-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NAME: Record<string, string> = { learnbound: "Learnbound", pocketmate: "Pocketmate", basalt: "Basalt", kelva: "Kelva" };
const mono = { fontFamily: "var(--font-mono)", fontSize: 12.5 } as const;
const zahl = (n: number | null) => (n === null ? "-" : Math.round(n).toLocaleString("de-CH"));
const termin = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("de-CH", { timeZone: "Europe/Zurich", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "-";
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function Marke({ an }: { an: boolean }) {
  return (
    <span className="klar-marke">
      <span className="klar-punkt" style={{ background: an ? "var(--success)" : "var(--fg-3)" }} aria-hidden="true" />
      {an ? "an" : "aus"}
    </span>
  );
}

/** Formats ranked by mean views after 24 hours, only posts Apify has read. */
function formatRanking(posts: RoutinePostView[]): Array<{ format: string; posts: number; views: number }> {
  const by = new Map<string, number[]>();
  for (const p of posts) if (p.format && p.views24h !== null) by.set(p.format, [...(by.get(p.format) ?? []), p.views24h]);
  return [...by.entries()]
    .map(([format, v]) => ({ format, posts: v.length, views: mean(v)! }))
    .sort((a, b) => b.views - a.views);
}

export default async function RoutinenPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const [routines, posts, tracked] = await Promise.all([listRoutines(), routinePosts(14), trackedHandles()]);
  const an = routines.filter((r) => r.active);
  const read = posts.filter((p) => p.views24h !== null);
  const best = [...read].sort((a, b) => (b.views24h ?? 0) - (a.views24h ?? 0))[0];
  const untracked = routines.flatMap((r) => r.accounts.map((a) => a.handle)).filter((h) => !tracked.has(h.toLowerCase()));

  return (
    <>
      <title>Routinen · Klar Control</title>
      <AdminTopbar titel="Routinen" />
      <div className="content">
        <PageHeader eyebrow="Klar Studios" icon={<CalendarClock />} title="Routinen">
          Die täglichen TikTok-Routinen. Jede Uhrzeit, die an ist, wird ein Post; die Routine liest das beim nächsten
          Lauf. Darunter jeder Post der letzten 14 Tage mit seinen Views, sobald Apify ihn gelesen hat.
        </PageHeader>

        <Kennzahlen
          zahlen={[
            { label: "Routinen an", wert: an.length, zusatz: `von ${routines.length}` },
            {
              label: "Posts am Tag",
              wert: an.reduce((n, r) => n + r.slots.length * r.accounts.length, 0),
              zusatz: "über alle Konten",
            },
            { label: "Gelesen", wert: `${read.length} / ${posts.length}`, zusatz: "Posts mit Views nach 24 h" },
            { label: "Bester Post", wert: best ? zahl(best.views24h) : "-", zusatz: best ? `${best.name}, Views nach 24 h` : "noch keiner gelesen" },
          ]}
        />

        {sp.msg || sp.err ? (
          <TextureCard className="mb-4 px-5 py-3.5 text-[12.5px] text-fg-2">{sp.err ?? sp.msg}</TextureCard>
        ) : null}
        {untracked.length ? (
          <TextureCard className="mb-4 px-5 py-3.5 text-[12.5px] text-fg-2">
            Apify liest diese Konten noch nicht, ihre Posts bleiben ohne Views: {untracked.map((h) => `@${h}`).join(", ")}.
          </TextureCard>
        ) : null}

        <div className="grid gap-4">
          {routines.map((r) => {
            const own = posts.filter((p) => p.app_slug === r.app_slug);
            const ranking = formatRanking(own);
            return (
              <TextureCard key={r.app_slug} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="m-0">{NAME[r.app_slug] ?? r.app_slug}</h2>
                      <Marke an={r.active} />
                    </div>
                    <p className="mt-1 text-fg-3" style={mono}>
                      {r.accounts.map((a) => `@${a.handle}`).join(" · ")} · Lauf {r.run_at ?? "-"} · {r.slots.length} Posts am Tag
                      {r.accounts.length > 1 ? " je Konto" : ""}
                    </p>
                  </div>
                  <form action="/admin/routinen/save" method="post">
                    <input type="hidden" name="app" value={r.app_slug} />
                    <input type="hidden" name="active" value={r.active ? "0" : "1"} />
                    <Button type="submit" variant={r.active ? "pill-dark" : "pill"}>
                      {r.active ? "Ausschalten" : "Einschalten"}
                    </Button>
                  </form>
                </div>

                <form action="/admin/routinen/save" method="post" className="mt-4 flex flex-wrap gap-2">
                  <input type="hidden" name="app" value={r.app_slug} />
                  {SLOT_CHOICES.map((s) => (
                    <button key={s} type="submit" name="slot" value={s} className="klar-chip" data-aus={r.slots.includes(s) ? undefined : "ja"}>
                      <span className="klar-punkt" style={{ background: "var(--success)" }} aria-hidden="true" />
                      {s}
                    </button>
                  ))}
                </form>

                <form action="/admin/routinen/save" method="post" className="mt-3 flex items-center gap-2 text-[12.5px] text-fg-2">
                  <input type="hidden" name="app" value={r.app_slug} />
                  <span>Höchstens {r.credits.toLocaleString("de-CH")} Higgsfield-Credits am Tag</span>
                  <button type="submit" name="credits" value="-1" className="klar-chip" aria-label="Ein Credit weniger">
                    weniger
                  </button>
                  <button type="submit" name="credits" value="1" className="klar-chip" aria-label="Ein Credit mehr">
                    mehr
                  </button>
                </form>

                {ranking.length ? (
                  <p className="mt-4 text-[12.5px] text-fg-2">
                    Formate nach Views in den ersten 24 h:{" "}
                    {ranking.map((f) => `${f.format} ${zahl(f.views)} (${f.posts})`).join(" · ")}
                  </p>
                ) : null}

                {own.length ? (
                  <div className="mt-4 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Termin</TableHead>
                          <TableHead>Post</TableHead>
                          <TableHead>Format</TableHead>
                          <TableHead className="text-right">24 h</TableHead>
                          <TableHead className="text-right">3 Tage</TableHead>
                          <TableHead className="text-right">Jetzt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {own.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell style={mono}>{termin(p.scheduledFor)}</TableCell>
                            <TableCell>
                              {p.url ? (
                                <a href={p.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                                  {p.name}
                                </a>
                              ) : (
                                p.name
                              )}
                              {r.accounts.length > 1 ? <span className="text-fg-3"> · @{p.handle}</span> : null}
                            </TableCell>
                            <TableCell className="text-fg-3">{p.format ?? "-"}</TableCell>
                            <TableCell className="text-right" style={mono}>{zahl(p.views24h)}</TableCell>
                            <TableCell className="text-right" style={mono}>{zahl(p.views3d)}</TableCell>
                            <TableCell className="text-right" style={mono}>
                              {p.url ? zahl(p.viewsNow) : <span className="text-fg-4">nicht gefunden</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="mt-4 text-[13px] text-fg-3">Noch keine Posts gemeldet.</p>
                )}
              </TextureCard>
            );
          })}
        </div>
      </div>
    </>
  );
}
