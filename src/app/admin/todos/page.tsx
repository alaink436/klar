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
import { ChevronRight } from "lucide-react";
import { requireAdminPage } from "../../../lib/adminGuard";
import { readCookie } from "../../../lib/adminSession";
import { LANG_COOKIE, normalizeAdminLang, tAdmin } from "../_i18n";
import { readTickets, type TicketEntry } from "@/lib/brainReader";
import { Card } from "@/components/ui/card";
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

function Fortschritt({ done, total }: { done: number; total: number }) {
  if (total === 0) return <span className="text-fg-4 text-[12px]">keine Kästchen</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1 w-16 overflow-hidden rounded-full bg-line-strong">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.round((done / total) * 100)}%`, background: done === total ? "var(--success)" : "var(--fg-2)" }}
        />
      </span>
      <span className="[font-family:var(--font-mono)] text-[11.5px] text-fg-2 [font-variant-numeric:tabular-nums]">
        {done}/{total}
      </span>
    </span>
  );
}

function TicketZeile({ t, all }: { t: TicketEntry; all: TicketEntry[] }) {
  const lane = laneOf(t);
  const blocker = lane === "blockiert" ? openBlockers(t, all) : [];
  return (
    <TableRow>
      <TableCell className="w-[52px] align-top [font-family:var(--font-mono)] text-[12px] text-fg-3">{t.number}</TableCell>
      <TableCell className="align-top">
        {/* Farbe als Inline-Stil: `_shared.ts` setzt `a{color:inherit}` ungeschichtet. */}
        <a href={t.url} target="_blank" rel="noopener" className="font-semibold hover:underline" style={{ color: "var(--fg)" }}>
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
      </TableCell>
      <TableCell className="align-top">
        <Badge tone={TONE[lane]}>{lane}</Badge>
      </TableCell>
      <TableCell className="align-top whitespace-nowrap">
        {t.readable ? <Fortschritt done={t.progress.done} total={t.progress.total} /> : null}
      </TableCell>
      <TableCell className="align-top text-[12.5px]">
        {!t.readable || t.status === "bereit" ? null : t.sessionTitle ? (
          <span className="text-fg-2">{t.sessionTitle}</span>
        ) : (
          <span className="text-fg-4">Session unbekannt</span>
        )}
      </TableCell>
      <TableCell className="align-top whitespace-nowrap text-[12px] text-fg-3">
        {t.readable && t.takenAt ? (
          <>
            <div className="[font-family:var(--font-mono)] [font-variant-numeric:tabular-nums]">{t.takenAt}</div>
            {lane === "in Arbeit" ? <div className="text-fg-4">{ageSince(t.takenAt)}</div> : null}
          </>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function TicketTabelle({ list, all }: { list: TicketEntry[]; all: TicketEntry[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nr</TableHead>
          <TableHead>Ticket</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Fortschritt</TableHead>
          <TableHead>Session</TableHead>
          <TableHead>Seit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.map((t) => (
          <TicketZeile key={t.path} t={t} all={all} />
        ))}
      </TableBody>
    </Table>
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
        <PageHeader eyebrow="Klar Control" title={t.navTickets}>
          Alle Tickets aus dem Vault, gelesen über GitHub und etwa eine Minute zwischengespeichert. Nur zum Lesen:
          geändert wird in der Ticket-Datei.
        </PageHeader>

        {!res.ok ? (
          <Card className="mb-4 border-[var(--danger)]/40 p-4 text-[13px]">
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
          </Card>
        ) : groups.length === 0 ? (
          <Card className="p-4 text-[13px] text-fg-3">
            Keine Tickets im Vault. Tickets liegen unter <code>Projects/&lt;Projekt&gt;/specs/&lt;feature&gt;/issues/</code>.
          </Card>
        ) : null}

        {groups.map((g) => {
          const all = [...g.open, ...g.closed];
          const zahl = (lane: TicketLane) => all.filter((x) => laneOf(x) === lane).length;
          const zusammen = (["in Arbeit", "frei", "blockiert", "nicht lesbar", "erledigt", "verworfen"] as TicketLane[])
            .map((lane) => (zahl(lane) ? `${zahl(lane)} ${lane}` : ""))
            .filter(Boolean)
            .join(" · ");
          return (
            <section key={`${g.project}/${g.feature}`} className="mb-8">
              <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="m-0 text-[15px] font-semibold text-fg">
                  {g.project} <span className="text-fg-4">·</span> {g.feature}
                </h2>
                <span className="text-[12px] text-fg-3">{zusammen}</span>
              </div>
              {g.open.length > 0 ? <TicketTabelle list={g.open} all={all} /> : null}
              {g.closed.length > 0 ? (
                <Collapsible className="group/zu mt-2">
                  <CollapsibleTrigger className="inline-flex cursor-pointer items-center gap-1 py-1 text-[12.5px] text-fg-3 hover:text-fg">
                    <ChevronRight className="size-3.5 transition-transform duration-150 group-data-[state=open]/zu:rotate-90" />
                    {g.closed.length} erledigt oder verworfen
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-1.5">
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
