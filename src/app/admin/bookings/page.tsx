// Klar Control · Bookings view.
//
// Server component. Reads cal_bookings from the Klar Inbox Supabase
// (anime-vault project, service-role key) — Cal.com writes there via webhook.
// Renders summary cards + a table inside the Klar Control chrome (same
// admin.css + same 2FA gate as the rest of /admin). Degrades to a setup
// hint when the service key is missing.
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET,
//      KLAR_INBOX_SUPABASE_URL (default anime-vault), KLAR_INBOX_SERVICE_KEY.

import { requireAdminPage } from "../../../lib/adminGuard";
import { inZone } from "@/lib/zeit";
import { CalendarDays } from "lucide-react";
import { TextureCard } from "@/components/ui/texture-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { AdminTopbar } from "../AdminTopbar";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KLAR_INBOX_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KLAR_INBOX_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

interface CalBooking {
  cal_uid?: string;
  trigger_event?: string;
  event_type_slug?: string;
  title?: string;
  start_time?: string;
  end_time?: string;
  attendee_email?: string;
  attendee_name?: string;
  location?: string;
  status?: string;
  created_at?: string;
}

type BookingsResult =
  | { kind: "nokey" }
  | { kind: "httperror"; status: number }
  | { kind: "neterror" }
  | { kind: "ok"; rows: CalBooking[] };

async function loadBookings(): Promise<BookingsResult> {
  if (!KLAR_INBOX_KEY) return { kind: "nokey" };
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/cal_bookings?select=cal_uid,trigger_event,event_type_slug,title,start_time,end_time,attendee_email,attendee_name,location,status,created_at&order=start_time.desc&limit=200`,
      {
        headers: {
          apikey: KLAR_INBOX_KEY,
          Authorization: `Bearer ${KLAR_INBOX_KEY}`,
          Accept: "application/json",
        },
        next: { revalidate: 30 },
      },
    );
    if (!res.ok) return { kind: "httperror", status: res.status };
    const j = await res.json();
    return { kind: "ok", rows: Array.isArray(j) ? (j as CalBooking[]) : [] };
  } catch {
    return { kind: "neterror" };
  }
}

// Ab lg eigene Spalten; darunter (Handy) stehen Status, Gast, Event und Ort
// unter dem Datum.
const BREIT = "hidden lg:table-cell";

function fmtWhen(s: unknown): string {
  return inZone(String(s ?? ""), { dateStyle: "medium", timeStyle: "short" }, "de-CH", String(s ?? ""));
}

function BookingPill({ r, now }: { r: CalBooking; now: number }) {
  if (r.status === "CANCELLED") return <Badge tone="danger">storniert</Badge>;
  const t = r.start_time ? new Date(r.start_time).getTime() : NaN;
  if (!isNaN(t) && t >= now) return <Badge tone="ok">anstehend</Badge>;
  return <Badge dot>vergangen</Badge>;
}

// Eine Kachel der Kennzahlenreihe: Label, Zahl, ein Halbsatz darunter.
function Kachel({ label, wert, zusatz }: { label: string; wert: number; zusatz?: string }) {
  return (
    <TextureCard className="px-5 py-4">
      <div className="[font-family:var(--font-mono)] text-[10.5px] font-medium uppercase tracking-[0.14em] text-fg-3">{label}</div>
      <div className="klar-verlauf mt-2.5 text-[34px] font-medium leading-none tracking-[-0.03em] [font-variant-numeric:tabular-nums]">
        {wert}
      </div>
      {zusatz ? <div className="mt-2 text-[12.5px] text-fg-3">{zusatz}</div> : null}
    </TextureCard>
  );
}

function Body({ result }: { result: BookingsResult }) {
  if (result.kind === "nokey") {
    return (
      <Notice tone="warn">
        Fast fertig, es fehlt nur der Lese-Key. Setze <code>KLAR_INBOX_SERVICE_KEY</code> im
        klar-Vercel-Projekt (Wert: anime-vault → Settings → API → <em>service_role</em>). Cal.com-Webhook
        schreibt schon nach <code>cal_bookings</code>, nur die Anzeige hier braucht den Key.
      </Notice>
    );
  }
  if (result.kind === "httperror") {
    return (
      <Notice tone="danger">
        Bookings konnten nicht geladen werden (HTTP {result.status}). Vermutlich stimmt
        der hinterlegte service_role-Key nicht, oder die Tabelle <code>cal_bookings</code>{" "}
        ist noch nicht migriert.
      </Notice>
    );
  }
  if (result.kind === "neterror") {
    return <Notice tone="danger">Netzwerkfehler beim Laden der Bookings.</Notice>;
  }

  const rows = result.rows;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const upcoming = rows.filter((r) => {
    const t = r.start_time ? new Date(r.start_time).getTime() : NaN;
    return !isNaN(t) && t >= now && r.status !== "CANCELLED";
  });
  const past7 = rows.filter((r) => {
    const t = r.created_at ? new Date(r.created_at).getTime() : NaN;
    return !isNaN(t) && now - t <= 7 * dayMs;
  });
  const cancelled = rows.filter((r) => r.status === "CANCELLED").length;

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        <Button asChild variant="pill" size="sm">
          <a href="https://cal.getklar.org/event-types" target="_blank" rel="noopener">
            Cal Admin öffnen ↗
          </a>
        </Button>
        <Button asChild variant="pill-dark" size="sm">
          <a href="https://cal.getklar.org/klar" target="_blank" rel="noopener">
            Booking-Seite ansehen ↗
          </a>
        </Button>
        <Button asChild variant="pill-dark" size="sm">
          <a href="https://cal.getklar.org/bookings/upcoming" target="_blank" rel="noopener">
            In Cal verwalten ↗
          </a>
        </Button>
      </div>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kachel label="Anstehend" wert={upcoming.length} zusatz="in der Zukunft" />
        <Kachel label="Letzte 7 Tage" wert={past7.length} zusatz="neue Buchungen" />
        <Kachel label="Storniert" wert={cancelled} />
        <Kachel label="Gesamt" wert={rows.length} zusatz="letzte 200" />
      </div>
      {/* Die Karte traegt Kante und Grund, die Tabelle darin steht ohne eigenen Rahmen. */}
      <TextureCard>
        <Table className="rounded-none border-0 bg-transparent [&_th]:bg-transparent [&_th]:pt-3.5">
          <TableHeader>
            <TableRow>
              <TableHead>Wann</TableHead>
              <TableHead className={BREIT}>Status</TableHead>
              <TableHead className={BREIT}>Gast</TableHead>
              <TableHead className={BREIT}>Event</TableHead>
              <TableHead className={BREIT}>Ort</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-fg-3">
                  noch keine Buchungen. Cal-Webhook konfiguriert (Settings → Webhooks →{" "}
                  <code>https://getklar.org/api/cal-webhook</code>)?
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => {
                const gast = (
                  <>
                    {r.attendee_name || ""}{" "}
                    {r.attendee_email ? (
                      <a
                        className="text-fg-2 underline decoration-white/25 underline-offset-4 transition-colors hover:text-fg hover:decoration-white/60"
                        href={`mailto:${r.attendee_email}`}
                      >
                        {r.attendee_email}
                      </a>
                    ) : null}
                  </>
                );
                return (
                  <TableRow key={r.cal_uid ?? i}>
                    <TableCell className="text-fg-3 lg:whitespace-nowrap">
                      {fmtWhen(r.start_time)}
                      {/* Unter lg dieselben Angaben als Zeilen unter dem Datum. */}
                      <div className="mt-2 flex flex-col items-start gap-1.5 lg:hidden">
                        <BookingPill r={r} now={now} />
                        <div className="text-fg">{gast}</div>
                        <div className="text-[12.5px]">
                          {[r.title || r.event_type_slug, r.location].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={BREIT}>
                      <BookingPill r={r} now={now} />
                    </TableCell>
                    <TableCell className={BREIT}>{gast}</TableCell>
                    <TableCell className={`${BREIT} max-w-[380px] text-[12.5px] text-fg-3`}>{r.title || r.event_type_slug || ""}</TableCell>
                    <TableCell className={`${BREIT} text-[12.5px] text-fg-3`}>{r.location || ""}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TextureCard>
    </>
  );
}

export default async function BookingsPage() {
  await requireAdminPage();

  const result = await loadBookings();

  return (
    <>
      <title>Bookings · Klar Control</title>
      <AdminTopbar titel="Bookings" />
      <div className="content">
        <PageHeader eyebrow="Klar Control" icon={<CalendarDays />} title="Bookings">
          Kommt per Webhook aus Cal.com. Fällt der aus, bleibt diese Liste still stehen statt leer.
        </PageHeader>
        <Body result={result} />
      </div>
    </>
  );
}
