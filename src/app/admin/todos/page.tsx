// Klar Control · Tickets. Die Ticket-Ansicht: alle Tickets aus dem Vault, über
// alle Projekte, gruppiert nach Projekt und Feature. Was läuft, wie weit es ist,
// welche Session dran ist, was frei ist und was blockiert.
//
// Nur lesen. Quelle ist die Ticket-Datei im Vault, gelesen über den
// Brain-Reader (lib/brainReader, etwa 60 s zwischengespeichert). Geändert wird
// im Vault, nicht hier. Die Route heisst weiter /admin/todos und der
// Menüeintrag weiter "todos", damit gespeicherte Menü-Cookies gelten.
//
// Server-Komponente. Das Einklappen der erledigten Tickets macht Collapsible im
// Browser; es bekommt nur fertiges Markup aus Ticketdaten, nichts Geheimes.
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET, BRAIN_GITHUB_TOKEN.

import { headers } from "next/headers";
import { ChevronRight, ClipboardList } from "lucide-react";
import { requireAdminPage } from "../../../lib/adminGuard";
import { readCookie } from "../../../lib/adminSession";
import { LANG_COOKIE, normalizeAdminLang, tAdmin } from "../_i18n";
import { readTickets, type TicketEntry } from "@/lib/brainReader";
import { TextureCard } from "@/components/ui/texture-card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ageSince, groupTickets, laneOf, openBlockers, shortComment, type TicketLane } from "./ticketGroups";
import { AdminTopbar } from "../AdminTopbar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TONE: Record<TicketLane, "info" | "ok" | "warn" | "danger" | "neutral"> = {
  "in Arbeit": "info",
  frei: "ok",
  blockiert: "warn",
  "nicht lesbar": "danger",
  erledigt: "neutral",
  verworfen: "neutral",
};

// Fortschritt als feine Leiste (`.klar-leiste` in admin.css), voll in Gruen.
function Fortschritt({ done, total }: { done: number; total: number }) {
  if (total === 0) return <span className="text-fg-4 text-[12px]">keine Kästchen</span>;
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="klar-leiste" data-voll={done === total ? "ja" : undefined}>
        <span style={{ width: `${Math.round((done / total) * 100)}%` }} />
      </span>
      <span className="[font-family:var(--font-mono)] text-[11.5px] text-fg-3 [font-variant-numeric:tabular-nums]">
        {done}/{total}
      </span>
    </span>
  );
}

// Ab lg stehen Status, Fortschritt, Session und Seit in eigenen Spalten. Darunter
// (Handy, schmale Fenster) waeren sechs Spalten zu eng; dort stehen dieselben
// Angaben als Zeile unter dem Titel.
const BREIT = "hidden lg:table-cell";

function TicketZeile({ t, all }: { t: TicketEntry; all: TicketEntry[] }) {
  const lane = laneOf(t);
  const blocker = lane === "blockiert" ? openBlockers(t, all) : [];
  const status = (
    <Badge tone={TONE[lane]} dot>
      {lane}
    </Badge>
  );
  const fortschritt = t.readable ? <Fortschritt done={t.progress.done} total={t.progress.total} /> : null;
  const session =
    !t.readable || t.status === "bereit" ? null : t.sessionTitle ? (
      <span className="text-fg-2">{t.sessionTitle}</span>
    ) : (
      <span className="text-fg-4">Session unbekannt</span>
    );
  const alter = t.readable && t.takenAt && lane === "in Arbeit" ? ageSince(t.takenAt) : null;
  return (
    <TableRow>
      <TableCell className="w-[52px] align-top [font-family:var(--font-mono)] text-[12px] text-fg-3">{t.number}</TableCell>
      <TableCell className="align-top">
        <a href={t.url} target="_blank" rel="noopener" className="font-medium text-fg hover:underline">
          {t.readable ? t.title : t.path.split("/").pop()} ↗
        </a>
        {!t.readable ? <div className="mt-1 text-[12px] text-danger">Nicht lesbar: {t.reason}</div> : null}
        {blocker.length > 0 ? (
          <div className="mt-1 text-[12px] text-fg-3">
            wartet auf {blocker.map((b) => `${b.number} (${b.lane})`).join(", ")}
          </div>
        ) : null}
        {t.readable && t.lastComment ? (
          <p className="m-0 mt-1.5 max-w-[90ch] text-[12px] leading-relaxed text-fg-3">{shortComment(t.lastComment)}</p>
        ) : null}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] lg:hidden">
          {status}
          {fortschritt}
          {session}
          {alter ? <span className="text-fg-4">{alter}</span> : null}
        </div>
      </TableCell>
      <TableCell className={`${BREIT} align-top`}>{status}</TableCell>
      <TableCell className={`${BREIT} align-top whitespace-nowrap`}>{fortschritt}</TableCell>
      <TableCell className={`${BREIT} align-top text-[12.5px]`}>{session}</TableCell>
      <TableCell className={`${BREIT} align-top whitespace-nowrap text-[12px] text-fg-3`}>
        {t.readable && t.takenAt ? (
          <>
            <div className="[font-family:var(--font-mono)] [font-variant-numeric:tabular-nums]">{t.takenAt}</div>
            {alter ? <div className="text-fg-4">{alter}</div> : null}
          </>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function TicketTabelle({ list, all }: { list: TicketEntry[]; all: TicketEntry[] }) {
  // Die Karte traegt Kante und Grund, die Tabelle darin steht ohne eigenen Rahmen.
  return (
    <TextureCard>
      <Table className="rounded-none border-0 bg-transparent [&_th]:bg-transparent [&_th]:pt-3.5">
        <TableHeader>
          <TableRow>
            <TableHead>Nr</TableHead>
            <TableHead>Ticket</TableHead>
            <TableHead className={BREIT}>Status</TableHead>
            <TableHead className={BREIT}>Fortschritt</TableHead>
            <TableHead className={BREIT}>Session</TableHead>
            <TableHead className={BREIT}>Seit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((t) => (
            <TicketZeile key={t.path} t={t} all={all} />
          ))}
        </TableBody>
      </Table>
    </TextureCard>
  );
}

export default async function TicketsPage() {
  await requireAdminPage();
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";

  const t = tAdmin(normalizeAdminLang(readCookie(cookieHeader, LANG_COOKIE)));
  const res = await readTickets();
  const groups = res.ok ? groupTickets(res.tickets) : [];

  return (
    <>
      <title>Tickets · Klar Control</title>
      <AdminTopbar titel={t.navTickets} />
      <div className="content" style={{ maxWidth: "none" }}>
        <PageHeader eyebrow="Klar Control" icon={<ClipboardList />} title={t.navTickets}>
          Alle Tickets aus dem Vault, gelesen über GitHub und etwa eine Minute zwischengespeichert. Nur zum Lesen:
          geändert wird in der Ticket-Datei.
        </PageHeader>

        {!res.ok ? (
          <TextureCard className="mb-4 p-5 text-[13.5px]">
            {res.status === 503 ? (
              <>
                <b>Tickets nicht lesbar.</b> Es fehlt <code>BRAIN_GITHUB_TOKEN</code>, ohne ihn kommt Klar Control nicht
                an den Vault.
              </>
            ) : (
              <>
                <b>Tickets nicht lesbar.</b> GitHub antwortet mit {res.status} ({res.error}). In einer Minute neu laden.
              </>
            )}
          </TextureCard>
        ) : groups.length === 0 ? (
          <TextureCard className="p-5 text-[13.5px] text-fg-3">
            Keine Tickets im Vault. Tickets liegen unter <code>Projects/&lt;Projekt&gt;/specs/&lt;feature&gt;/issues/</code>.
          </TextureCard>
        ) : null}

        {groups.map((g) => {
          const all = [...g.open, ...g.closed];
          const zahl = (lane: TicketLane) => all.filter((x) => laneOf(x) === lane).length;
          const zusammen = (["in Arbeit", "frei", "blockiert", "nicht lesbar", "erledigt", "verworfen"] as TicketLane[])
            .map((lane) => (zahl(lane) ? `${zahl(lane)} ${lane}` : ""))
            .filter(Boolean)
            .join(" · ");
          return (
            <section key={`${g.project}/${g.feature}`} className="mb-10">
              <div className="mb-3.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="m-0 inline [font-family:var(--font-body)] text-[17px] font-medium normal-case tracking-[-0.015em] text-fg after:hidden">
                  {g.project} <span className="text-fg-4">·</span> {g.feature}
                </h2>
                <span className="text-[12.5px] text-fg-3">{zusammen}</span>
              </div>
              {g.open.length > 0 ? <TicketTabelle list={g.open} all={all} /> : null}
              {g.closed.length > 0 ? (
                <Collapsible className="group/zu mt-3">
                  <CollapsibleTrigger className="klar-pille klar-pille-dunkel h-7 gap-1.5 pl-2 pr-3 text-[12px] text-fg-2 hover:text-fg">
                    <ChevronRight className="size-3.5 transition-transform duration-150 group-data-[state=open]/zu:rotate-90" />
                    {g.closed.length} erledigt oder verworfen
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <TicketTabelle list={g.closed} all={all} />
                  </CollapsibleContent>
                </Collapsible>
              ) : null}
            </section>
          );
        })}
      </div>
    </>
  );
}
