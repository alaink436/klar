// Klar Control · Bookings view.
//
// Server component. Reads cal_bookings from the Klar Inbox Supabase
// (anime-vault project, service-role key) — Cal.com writes there via webhook.
// Renders summary cards + a table inside the Klar Control chrome (same
// STYLE/ICON + same 2FA gate as the rest of /admin). Degrades to a setup
// hint when the service key is missing.
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET,
//      KLAR_INBOX_SUPABASE_URL (default anime-vault), KLAR_INBOX_SERVICE_KEY.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  STYLE,
  ICON,
  FONTS_LINK,
  THEME_INIT_SCRIPT,
  THEME_TOGGLE_SCRIPT,
  GLASS_SVG_DEFS,
  SMOKE_BG_SCRIPT,
  readCookieFromString,
  adminSidebar,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps } from "../../../lib/adminApps";

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
        cache: "no-store",
      },
    );
    if (!res.ok) return { kind: "httperror", status: res.status };
    const j = await res.json();
    return { kind: "ok", rows: Array.isArray(j) ? (j as CalBooking[]) : [] };
  } catch {
    return { kind: "neterror" };
  }
}

function fmtWhen(s: unknown): string {
  const d = new Date(String(s));
  return isNaN(d.getTime())
    ? String(s ?? "")
    : d.toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" });
}

function BookingPill({ r, now }: { r: CalBooking; now: number }) {
  if (r.status === "CANCELLED") return <span className="pill warn">storniert</span>;
  const t = r.start_time ? new Date(r.start_time).getTime() : NaN;
  if (!isNaN(t) && t >= now) return <span className="pill live">anstehend</span>;
  return <span className="pill">vergangen</span>;
}

function Body({ result }: { result: BookingsResult }) {
  if (result.kind === "nokey") {
    return (
      <p className="sub muted">
        Fast fertig, es fehlt nur der Lese-Key. Setze{" "}
        <span className="warn">KLAR_INBOX_SERVICE_KEY</span> im klar-Vercel-Projekt
        (Wert: anime-vault → Settings → API → <em>service_role</em>). Cal.com-Webhook
        schreibt schon nach <code>cal_bookings</code>, nur die Anzeige hier braucht den
        Key.
      </p>
    );
  }
  if (result.kind === "httperror") {
    return (
      <p className="sub muted">
        Bookings konnten nicht geladen werden (HTTP {result.status}). Vermutlich stimmt
        der hinterlegte service_role-Key nicht, oder die Tabelle <code>cal_bookings</code>{" "}
        ist noch nicht migriert.
      </p>
    );
  }
  if (result.kind === "neterror") {
    return <p className="sub muted">Netzwerkfehler beim Laden der Bookings.</p>;
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
      <p className="sub">Cal.com-Buchungen, per Webhook live in Supabase. Anstehende oben.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 16px 0" }}>
        <a className="btn pop" href="https://cal.getklar.org/event-types" target="_blank" rel="noopener">
          Cal Admin öffnen ↗
        </a>
        <a className="btn ghost" href="https://cal.getklar.org/klar/affiliate-intro" target="_blank" rel="noopener">
          Booking-Seite ansehen ↗
        </a>
        <a className="btn ghost" href="https://cal.getklar.org/bookings/upcoming" target="_blank" rel="noopener">
          In Cal verwalten ↗
        </a>
      </div>
      <div className="cards">
        <div className="card">
          <div className="k">Anstehend</div>
          <div className="v">{upcoming.length}</div>
          <div className="s">in der Zukunft</div>
        </div>
        <div className="card">
          <div className="k">Letzte 7 Tage</div>
          <div className="v">{past7.length}</div>
          <div className="s">neue Buchungen</div>
        </div>
        <div className="card">
          <div className="k">Storniert</div>
          <div className="v">{cancelled}</div>
        </div>
        <div className="card">
          <div className="k">Gesamt</div>
          <div className="v">{rows.length}</div>
          <div className="s">letzte 200</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Wann</th>
            <th>Status</th>
            <th>Gast</th>
            <th>Event</th>
            <th>Ort</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted">
                noch keine Buchungen. Cal-Webhook konfiguriert (Settings → Webhooks →{" "}
                <code>https://getklar.org/api/cal-webhook</code>)?
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={r.cal_uid ?? i}>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>
                  {fmtWhen(r.start_time)}
                </td>
                <td>
                  <BookingPill r={r} now={now} />
                </td>
                <td>
                  {r.attendee_name || ""}{" "}
                  {r.attendee_email ? (
                    <a className="applink" href={`mailto:${r.attendee_email}`}>
                      {r.attendee_email}
                    </a>
                  ) : null}
                </td>
                <td className="muted" style={{ fontSize: 12, maxWidth: 380 }}>
                  {r.title || r.event_type_slug || ""}
                </td>
                <td className="muted" style={{ fontSize: 12 }}>
                  {r.location || ""}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );
}

export default async function BookingsPage() {
  // Auth — identical gate to brain/cal/analytics/settings (device cookie + admin session).
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) redirect("/admin/login");
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const device = await verifyDeviceCookie(readCookieFromString(cookieHeader, "klar_device"), DEV);
  if (!device) redirect("/admin/login");
  if (readCookieFromString(cookieHeader, "klar_admin") !== KEY) redirect("/admin/login");

  const result = await loadBookings();
  const sidebar = adminSidebar("bookings", getApps());
  const topbar = `
    <span class="crumb"><b>Bookings</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>Bookings · Klar Control</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={FONTS_LINK} rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_TOGGLE_SCRIPT }} />
      <canvas id="klar-smoke-bg" aria-hidden="true" suppressHydrationWarning />
      <div className="klar-aurora" aria-hidden="true" />
      <div dangerouslySetInnerHTML={{ __html: GLASS_SVG_DEFS }} />
      <div className="layout">
        <aside className="side" dangerouslySetInnerHTML={{ __html: sidebar }} />
        <main className="main">
          <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
          <div className="content">
            <h1>Bookings</h1>
            <Body result={result} />
          </div>
        </main>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SMOKE_BG_SCRIPT }} />
    </>
  );
}
