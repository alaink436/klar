// Klar Control · App-Nutzung.
//
// Server component. Shows what PostHog knows about one Klar app: users per
// day, app starts, installs, the screens people actually open and which app
// version is in the field. The numbers come from src/lib/posthog.ts, which
// queries PostHog with the personal key from the vault; nothing PostHog-
// specific reaches the browser except the "open in PostHog" link.
//
// Same 2FA gate as every other /admin page. Query string: `app` picks the app
// (default: first in POSTHOG_APPS), `p` the period in days (7, 30, 90).
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET, plus the vault
//      master key (VAULT_MASTER_KEY) so the PostHog key can be decrypted.

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readCookieFromString } from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import {
  POSTHOG_APPS,
  fetchAppUsage,
  posthogDashboardUrl,
  type RankedRow,
  type UsagePeriod,
} from "../../../lib/posthog";
import { AdminTopbar } from "../AdminTopbar";
import { Kennzahlen, type Kennzahl } from "../Kennzahlen";
import UsageChart from "./UsageChart";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PERIODS: { id: UsagePeriod; label: string }[] = [
  { id: 7, label: "7 Tage" },
  { id: 30, label: "30 Tage" },
  { id: 90, label: "90 Tage" },
];

function parsePeriod(raw: string | undefined): UsagePeriod {
  const n = Number(raw);
  return n === 7 || n === 90 ? n : 30;
}

function hrefFor(app: string, period: UsagePeriod): string {
  return `/admin/app-analytics?app=${encodeURIComponent(app)}&p=${period}`;
}

const num = (n: number) => n.toLocaleString("de-CH");

function RankedTable({ rows, head, unit }: { rows: RankedRow[]; head: string; unit: string }) {
  if (rows.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Noch nichts angekommen.
      </p>
    );
  }
  const max = rows[0]?.count || 1;
  return (
    <table>
      <thead>
        <tr>
          <th>{head}</th>
          <th style={{ textAlign: "right" }}>{unit}</th>
          <th style={{ width: "40%" }} aria-hidden="true" />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <td style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.name}</td>
            <td style={{ textAlign: "right" }}>{num(r.count)}</td>
            <td>
              <div
                aria-hidden="true"
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: "var(--fg)",
                  opacity: 0.55,
                  width: `${Math.max(3, Math.round((r.count / max) * 100))}%`,
                }}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function AppAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string; p?: string }>;
}) {
  // Auth: matches /admin route — requires klar_device (HMAC-verified) + klar_admin
  // session (KLAR_ADMIN_KEY equality). Both cookies are issued by /admin/login
  // after admin-key + TOTP succeed.
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) redirect("/admin/login");
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const device = await verifyDeviceCookie(readCookieFromString(cookieHeader, "klar_device"), DEV);
  if (!device) redirect("/admin/login");
  if (readCookieFromString(cookieHeader, "klar_admin") !== KEY) redirect("/admin/login");

  const sp = await searchParams;
  const app = POSTHOG_APPS.find((a) => a.slug === sp.app) ?? POSTHOG_APPS[0];
  const period = parsePeriod(sp.p);
  const result = await fetchAppUsage(app.slug, period);

  const kennzahlen: Kennzahl[] = result.ok
    ? [
        { label: "Nutzer heute", wert: num(result.usage.usersToday), zusatz: "haben die App heute geöffnet" },
        { label: "Nutzer 7 Tage", wert: num(result.usage.users7), zusatz: "eindeutige Personen, letzte Woche" },
        { label: `Nutzer ${period} Tage`, wert: num(result.usage.users), zusatz: "eindeutige Personen im Zeitraum" },
        { label: "App-Starts", wert: num(result.usage.starts), zusatz: `Öffnungen in ${period} Tagen` },
        { label: "Installationen", wert: num(result.usage.installs), zusatz: `erste Starts in ${period} Tagen` },
      ]
    : [];

  return (
    <>
      <title>App-Nutzung · Klar Control</title>
      <AdminTopbar
        titel="App-Nutzung"
        rechts={
          <a href={posthogDashboardUrl(app)} target="_blank" rel="noopener noreferrer" className="pill">
            In PostHog öffnen
          </a>
        }
      />
      <div className="content">
        <h1>App-Nutzung</h1>
        <p className="muted" style={{ marginTop: -6, marginBottom: 18, fontSize: 13.5 }}>
          Was die Apps an PostHog melden: Starts, Screens, Versionen. Die Zahlen sind bis zu fünf Minuten alt.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <div className="seg" role="tablist" aria-label="App">
            {POSTHOG_APPS.map((a) => (
              <Link key={a.slug} href={hrefFor(a.slug, period)} className={a.slug === app.slug ? "on" : ""} role="tab" aria-selected={a.slug === app.slug} prefetch>
                {a.label}
              </Link>
            ))}
          </div>
          <div className="seg" role="tablist" aria-label="Zeitraum">
            {PERIODS.map((p) => (
              <Link key={p.id} href={hrefFor(app.slug, p.id)} className={p.id === period ? "on" : ""} role="tab" aria-selected={p.id === period} prefetch>
                {p.label}
              </Link>
            ))}
          </div>
        </div>

        {!result.ok ? (
          <div className="card">
            <div className="k">PostHog antwortet nicht</div>
            <div className="s" style={{ marginTop: 6 }}>{result.error}</div>
          </div>
        ) : (
          <>
            <Kennzahlen zahlen={kennzahlen} />

            <h2>Verlauf</h2>
            <div className="chart">
              {result.usage.series.some((p) => p.users > 0 || p.starts > 0) ? (
                <UsageChart points={result.usage.series} />
              ) : (
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                  Noch keine Starts im Zeitraum. Sobald die App mit PostHog draussen ist, füllt sich die Kurve.
                </p>
              )}
            </div>

            <div className="chart-grid">
              <div>
                <h2>Screens</h2>
                <RankedTable rows={result.usage.screens} head="Screen" unit="Aufrufe" />
              </div>
              <div>
                <h2>Versionen im Feld (7 Tage)</h2>
                <RankedTable rows={result.usage.versions} head="App-Version" unit="Nutzer" />
              </div>
            </div>

            <p className="muted" style={{ fontSize: 12, marginTop: 24 }}>
              PostHog-Projekt „Klar Apps“, Filter <code>app = {app.slug}</code>, Antwort in {num(result.usage.tookMs)} ms.
            </p>
          </>
        )}
      </div>
    </>
  );
}
