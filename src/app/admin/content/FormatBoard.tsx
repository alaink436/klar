// Content · Formate: the routines' formats and their posts, by app and by channel (Alain 2026-11-09: "den Tab
// Content neu, mit einerseits den Formaten, dann die Posts dort drinnen, und dann unterteilt auf Apps, und auch
// Kanäle"). The landing tab of /admin/content; the map and the Blotato pipeline stay as tabs behind it.
//
// Choices live in the URL (?tab=formate&app=&kanal=&format=), like the pipeline's filters. Data: the posts the
// routines reported (lib/routines) with the views Evomi read (lib/ownViews), summed up in lib/formatBoard. The same
// summary goes to the routines through GET /api/routines/performance.

import Link from "next/link";
import { hookOf, rankPosts, summarizeFormats } from "@/lib/formatBoard";
import { listRoutines, routinePosts } from "@/lib/routines";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TextureCard } from "@/components/ui/texture-card";

const DAYS = 30;
const NAME: Record<string, string> = { learnbound: "Learnbound", pocketmate: "Pocketmate", basalt: "Basalt", kelva: "Kelva" };
const mono = { fontFamily: "var(--font-mono)", fontSize: 12.5 } as const;
const zahl = (n: number | null) => (n === null ? "-" : Math.round(n).toLocaleString("de-CH"));
const termin = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("de-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "-";

function href(q: { app?: string; kanal?: string; format?: string }): string {
  const sp = new URLSearchParams({ tab: "formate" });
  for (const [k, v] of Object.entries(q)) if (v) sp.set(k, v);
  return `/admin/content?${sp.toString()}`;
}

function Chip({ to, on, children }: { to: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link href={to} className="klar-chip" data-aus={on ? undefined : "ja"} aria-current={on ? "true" : undefined}>
      <span className="klar-punkt" style={{ background: "var(--success)" }} aria-hidden="true" />
      {children}
    </Link>
  );
}

export async function FormatBoard({ app, kanal, format }: { app?: string; kanal?: string; format?: string }) {
  const [routines, all] = await Promise.all([listRoutines(), routinePosts(DAYS)]);
  const apps = routines.map((r) => r.app_slug);
  const selApp = app && apps.includes(app) ? app : undefined;
  const channels = routines.filter((r) => !selApp || r.app_slug === selApp).flatMap((r) => r.accounts.map((a) => a.handle.toLowerCase()));
  const selKanal = kanal && channels.includes(kanal) ? kanal : undefined;
  const inScope = all.filter((p) => (!selApp || p.app_slug === selApp) && (!selKanal || p.handle === selKanal));
  const formats = summarizeFormats(inScope);
  const selFormat = format && formats.some((f) => f.format === format) ? format : undefined;
  const shown = rankPosts(inScope.filter((p) => !selFormat || (p.format ?? "-") === selFormat));

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 [font-family:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[0.14em] text-fg-4">Apps</span>
        <Chip to={href({})} on={!selApp}>
          Alle
        </Chip>
        {apps.map((a) => (
          <Chip key={a} to={href({ app: a })} on={selApp === a}>
            {NAME[a] ?? a}
          </Chip>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 [font-family:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[0.14em] text-fg-4">Kanäle</span>
        <Chip to={href({ app: selApp })} on={!selKanal}>
          Alle
        </Chip>
        {channels.map((h) => (
          <Chip key={h} to={href({ app: selApp, kanal: h })} on={selKanal === h}>
            @{h}
          </Chip>
        ))}
      </div>

      <TextureCard className="mb-4 p-5">
        <h2 className="m-0 mb-1">Formate</h2>
        <p className="mb-3 mt-0 text-[12.5px] text-fg-3">
          Letzte {DAYS} Tage, sortiert nach den Views in den ersten 24 Stunden. Ein Klick zeigt die Posts des Formats.
        </p>
        {formats.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Format</TableHead>
                  {selApp ? null : <TableHead>App</TableHead>}
                  <TableHead className="text-right">Posts</TableHead>
                  <TableHead className="text-right">Gelesen</TableHead>
                  <TableHead className="text-right">Ø 24 h</TableHead>
                  <TableHead className="text-right">Ø 3 Tage</TableHead>
                  <TableHead>Bester Post</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formats.map((f) => (
                  <TableRow key={`${f.app_slug}-${f.format}`} aria-selected={selFormat === f.format}>
                    <TableCell>
                      <Link
                        href={href({ app: selApp ?? f.app_slug, kanal: selKanal, format: selFormat === f.format ? undefined : f.format })}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {f.format}
                      </Link>
                    </TableCell>
                    {selApp ? null : <TableCell className="text-fg-3">{NAME[f.app_slug] ?? f.app_slug}</TableCell>}
                    <TableCell className="text-right" style={mono}>{f.posts}</TableCell>
                    <TableCell className="text-right" style={mono}>{f.read}</TableCell>
                    <TableCell className="text-right" style={mono}>{zahl(f.avg24h)}</TableCell>
                    <TableCell className="text-right" style={mono}>{zahl(f.avg3d)}</TableCell>
                    <TableCell className="text-fg-3">{f.best ? `${f.best.name} (${zahl(f.best.views24h)})` : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="m-0 text-[13px] text-fg-3">Noch keine Posts gemeldet.</p>
        )}
      </TextureCard>

      <TextureCard className="p-5">
        <h2 className="m-0 mb-1">{selFormat ? `Posts im Format ${selFormat}` : "Posts"}</h2>
        <p className="mb-3 mt-0 text-[12.5px] text-fg-3">
          Die meisten Views nach 24 Stunden zuerst. Noch nicht gelesene Posts danach, die neuesten oben.
        </p>
        {shown.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Termin</TableHead>
                  <TableHead>Post</TableHead>
                  <TableHead>Hook</TableHead>
                  <TableHead className="text-right">24 h</TableHead>
                  <TableHead className="text-right">3 Tage</TableHead>
                  <TableHead className="text-right">Jetzt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((p) => (
                  <TableRow key={`${p.handle}-${p.name}`}>
                    <TableCell style={mono}>{termin(p.scheduledFor)}</TableCell>
                    <TableCell>
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                          {p.name}
                        </a>
                      ) : (
                        p.name
                      )}
                      <span className="text-fg-3"> · {p.format ?? "-"} · @{p.handle}</span>
                    </TableCell>
                    <TableCell className="max-w-[360px] truncate text-fg-2" title={hookOf(p.caption)}>
                      {hookOf(p.caption) || "-"}
                    </TableCell>
                    <TableCell className="text-right" style={mono}>{zahl(p.views24h)}</TableCell>
                    <TableCell className="text-right" style={mono}>{zahl(p.views3d)}</TableCell>
                    <TableCell className="text-right" style={mono}>
                      {p.url ? (
                        zahl(p.viewsNow)
                      ) : (
                        <span className="text-fg-4">{p.planned ? "geplant" : "nicht gefunden"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="m-0 text-[13px] text-fg-3">Keine Posts in dieser Auswahl.</p>
        )}
      </TextureCard>
    </>
  );
}
