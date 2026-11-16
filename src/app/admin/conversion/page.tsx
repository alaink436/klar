// Klar Control · Conversion (Alain, 2026-11-16: "die Conversionrate stark verbessern"; first built in the
// OurApps dashboard, moved here so the PostHog key from the vault serves it).
//
// Server component. Per app (Basalt, Kelva): the change log, the funnel's four rates over twelve weeks with
// each change as a numbered mark, PostHog's own funnel (installed > paywall seen > buy tap > trial or
// purchase), and the new users per week and build. Numbers from src/lib/posthog.ts, five minutes fresh; the
// open page asks again every five minutes. Query string: app, os (ios/android), tage (7/30/90), takt (day).
//
// Env: as App-Nutzung (admin gate, VAULT_MASTER_KEY for the PostHog key) plus KLAR_INBOX_SERVICE_KEY for
// the change log in the Klar-Hub.

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Filter } from "lucide-react";
import { requireAdminPage } from "../../../lib/adminGuard";
import { listAppChanges } from "../../../lib/appChanges";
import {
  formatShare,
  FUNNEL_STEPS,
  INTERVALS,
  intervalOf,
  isPlatform,
  lastWeeks,
  markAt,
  PLATFORMS,
  RANGES,
  rangeOf,
  share,
  summarize,
  TREND_DAYS,
  TREND_STEPS,
  type Interval,
  type Platform,
  type Range,
  type Steps,
} from "../../../lib/conversion";
import { CONVERSION_APPS, fetchConversion, posthogDashboardUrl } from "../../../lib/posthog";
import { AdminTopbar } from "../AdminTopbar";
import { PageHeader } from "@/components/ui/page-header";
import { TextureCard } from "@/components/ui/texture-card";
import { FUNNEL_LEGEND, FunnelBars, Legend, TrendLine } from "./charts";
import { LiveRefresh } from "./live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ddmm = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.`;
const conversion = (s: Steps) => share(s.trials + s.direkt, s.neu);

function hrefFor(app: string, platform: Platform | null, days: Range, interval: Interval): string {
  const q = new URLSearchParams({ app });
  if (platform) q.set("os", platform);
  if (days !== 30) q.set("tage", String(days));
  if (interval !== "week") q.set("takt", interval);
  return `/admin/conversion?${q}`;
}

/** A count with its share of the step before, the share quiet. */
function Count({ n, of }: { n: number; of?: number }) {
  return (
    <>
      <span className="text-fg">{n}</span>
      {of !== undefined && <span className="ml-2 text-[11.5px] text-fg-3">{formatShare(share(n, of))}</span>}
    </>
  );
}

const HEADS = ["Neu", "Zur Paywall", "Kauf-Klick", "Trials", "Direktkäufe", "Conversion"];
const num = { textAlign: "right" as const, fontFamily: "var(--font-mono)", fontSize: 12.5 };

function StepTable({ first, rows }: { first: string; rows: { key: string; label: ReactNode; s: Steps }[] }) {
  return (
    <TextureCard className="overflow-x-auto">
      <table className="rounded-none border-0 bg-transparent [&_th]:bg-transparent">
        <thead>
          <tr>
            <th>{first}</th>
            {HEADS.map((h) => (
              <th key={h} style={{ textAlign: "right" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, s }) => (
            <tr key={key}>
              <td style={{ whiteSpace: "nowrap" }}>{label}</td>
              <td style={num}><Count n={s.neu} /></td>
              <td style={num}><Count n={s.paywall} of={s.neu} /></td>
              <td style={num}><Count n={s.klick} of={s.paywall} /></td>
              <td style={num}><Count n={s.trials} /></td>
              <td style={num}><Count n={s.direkt} /></td>
              <td style={{ ...num, fontWeight: 600 }}>{formatShare(conversion(s))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TextureCard>
  );
}

export default async function ConversionPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string; os?: string; tage?: string; takt?: string; err?: string }>;
}) {
  await requireAdminPage();

  const sp = await searchParams;
  const app = CONVERSION_APPS.find((a) => a.slug === sp.app) ?? CONVERSION_APPS[0];
  const platform = isPlatform(sp.os) ? sp.os : null;
  const days = rangeOf(sp.tage);
  const interval = intervalOf(sp.takt);
  const weeks = lastWeeks(new Date());
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());
  const since = new Date(`${today}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - TREND_DAYS - 7);
  const [result, changes] = await Promise.all([
    fetchConversion(app, days, interval, platform, weeks[0]),
    listAppChanges(app.slug, since.toISOString().slice(0, 10)),
  ]);

  // Numbered oldest first, so the marks count up from left to right; listed newest first.
  const logged = changes.map((c, i) => ({ ...c, n: changes.length - i }));
  const lines = result.ok ? result.conversion.trends : [];
  const axis = lines.find((l) => l.length > 1) ?? [];
  const marks = logged.flatMap((c) => {
    const at = markAt(c.day, axis, interval);
    return at === null ? [] : [{ n: c.n, at, text: c.text }];
  });

  return (
    <>
      <title>Conversion · Klar Control</title>
      <AdminTopbar titel="Conversion" />
      <div className="content">
        <PageHeader eyebrow="Klar Control" icon={<Filter />} title="Conversion">
          Wie viele Installierte bis zur Paywall, zum Kauf-Klick und zum Trial oder Kauf kommen, und was sich nach jeder Änderung tut. Zahlen aus PostHog.
        </PageHeader>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
          <div className="klar-segment" role="tablist" aria-label="App">
            {CONVERSION_APPS.map((a) => (
              <Link key={a.slug} href={hrefFor(a.slug, platform, days, interval)} role="tab" aria-selected={a.slug === app.slug} prefetch>
                {a.label}
              </Link>
            ))}
          </div>
          <div className="klar-segment" role="tablist" aria-label="Plattform">
            {([null, "ios", "android"] as (Platform | null)[]).map((p) => (
              <Link key={p ?? "alle"} href={hrefFor(app.slug, p, days, interval)} role="tab" aria-selected={p === platform} prefetch>
                {p ? PLATFORMS[p] : "Alle"}
              </Link>
            ))}
          </div>
          {result.ok && <LiveRefresh at={new Date(result.conversion.at).toISOString()} />}
          <a
            href={posthogDashboardUrl(app)}
            target="_blank"
            rel="noopener noreferrer"
            className="klar-pille klar-pille-dunkel h-8 gap-1.5 px-4 text-[12.5px] sm:ml-auto [&_svg]:size-3.5"
          >
            In PostHog öffnen
            <ArrowUpRight />
          </a>
        </div>

        <h2>Änderungen</h2>
        <TextureCard className="mb-2 px-4 py-3 sm:px-6">
          {logged.length === 0 ? (
            <p className="m-0 py-2 text-[13px] text-fg-3">Noch keine Änderung eingetragen.</p>
          ) : (
            <ol className="m-0 list-none divide-y divide-line p-0">
              {logged.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2 text-[13px]">
                  <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-medium text-fg-2 tabular-nums">{c.n}</span>
                  <span className="w-12 shrink-0 text-fg-3 tabular-nums">{ddmm(c.day)}</span>
                  <span className="min-w-0 flex-1 text-fg-2">{c.text}</span>
                  {c.via === "agent" && <span className="shrink-0 text-[11px] text-fg-4">Agent</span>}
                  <form method="post" action="/admin/conversion/aenderung" className="m-0 shrink-0">
                    <input type="hidden" name="remove" value={c.id} />
                    <button type="submit" aria-label={`Änderung vom ${ddmm(c.day)} löschen`} className="rounded px-1 text-fg-4 transition hover:text-fg">
                      ×
                    </button>
                  </form>
                </li>
              ))}
            </ol>
          )}
          <form method="post" action="/admin/conversion/aenderung" className="mt-3 flex flex-wrap items-center gap-2" autoComplete="off">
            <input type="hidden" name="app" value={app.slug} />
            <input name="day" type="date" required defaultValue={today} max={today} aria-label="Tag der Änderung" className="h-9 w-40 rounded-md border border-line bg-transparent px-2 text-[13px] text-fg" />
            <input
              name="text"
              required
              maxLength={200}
              placeholder="Was wurde geändert, zum Beispiel: Gratiswoche wieder vorgewählt (OTA)"
              aria-label="Was wurde geändert"
              className="h-9 min-w-48 flex-1 rounded-md border border-line bg-transparent px-3 text-[13px] text-fg placeholder:text-fg-4"
            />
            <button type="submit" className="klar-pille klar-pille-dunkel h-9 px-4 text-[12.5px]">
              Eintragen
            </button>
          </form>
          {sp.err && <p className="m-0 mt-2 text-[12.5px] text-[var(--destructive)]">{sp.err}</p>}
        </TextureCard>

        {!result.ok ? (
          <TextureCard className="mt-6 p-5">
            <div className="text-[14px] font-medium text-fg">PostHog antwortet nicht</div>
            <div className="mt-1.5 text-[13px] leading-relaxed text-fg-3">{result.error}</div>
          </TextureCard>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2>Verlauf, letzte zwölf Wochen</h2>
              <div className="klar-segment mb-3" role="tablist" aria-label="Takt">
                {(Object.keys(INTERVALS) as Interval[]).map((i) => (
                  <Link key={i} href={hrefFor(app.slug, platform, days, i)} role="tab" aria-selected={i === interval} prefetch>
                    {INTERVALS[i]}
                  </Link>
                ))}
              </div>
            </div>
            <TextureCard className="mb-2 px-4 pb-5 pt-6 sm:px-6">
              <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
                {TREND_STEPS.map((t, i) => (
                  <TrendLine key={t.label} title={t.label} points={lines[i] ?? []} marks={marks} />
                ))}
              </div>
              <p className="m-0 mt-5 text-[12px] text-fg-4">
                PostHogs Funnel-Verlauf: Anteil vom einen Schritt zum nächsten, innert 14 Tagen. Jeder Graph hat seine eigene Skala, die laufende Woche ist gestrichelt.
              </p>
            </TextureCard>

            {(() => {
              const f = result.conversion.funnel;
              const bought = f.counts[FUNNEL_STEPS.length - 1] ?? 0;
              return (
                <>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <h2>
                      Funnel · Gesamt-Conversion {formatShare(share(bought, f.counts[0] ?? 0))}
                    </h2>
                    <div className="klar-segment mb-3" role="tablist" aria-label="Zeitraum">
                      {RANGES.map((r) => (
                        <Link key={r} href={hrefFor(app.slug, platform, r, interval)} role="tab" aria-selected={r === days} prefetch>
                          {r} Tage
                        </Link>
                      ))}
                    </div>
                  </div>
                  <TextureCard className="mb-2 px-4 pb-5 pt-5 sm:px-6">
                    <div className="mb-2 flex justify-end">
                      <Legend items={FUNNEL_LEGEND} />
                    </div>
                    <FunnelBars
                      steps={FUNNEL_STEPS.map((label, i) => ({
                        label,
                        count: f.counts[i] ?? 0,
                        note: i === FUNNEL_STEPS.length - 1 ? `davon ${f.trials} Trials, ${bought - f.trials} direkt` : undefined,
                      }))}
                    />
                    <p className="m-0 mt-5 text-[12px] text-fg-4">
                      PostHogs eigener Funnel: wer in den letzten {days} Tagen installiert hat, und wer danach die Schritte in dieser Reihenfolge innert 14 Tagen erreicht. Paywall ohne Pro-Nutzer, Käufe ohne Sandbox.
                    </p>
                  </TextureCard>
                </>
              );
            })()}

            {(() => {
              const { weeks: perWeek, builds } = summarize(result.conversion.rows, app.slug, weeks);
              return (
                <>
                  <h2>Pro Woche, nach erster Woche in PostHog</h2>
                  <StepTable
                    first="Woche ab"
                    rows={[...perWeek].reverse().map((w, i) => ({
                      key: w.week,
                      label: (
                        <>
                          {ddmm(w.week)}
                          {i === 0 && <span className="ml-2 text-[11.5px] text-fg-3">läuft</span>}
                        </>
                      ),
                      s: w.steps,
                    }))}
                  />
                  {builds.length > 0 && (
                    <>
                      <h2>Nach Build, letzte acht Wochen</h2>
                      <StepTable first="Build" rows={builds.map((b) => ({ key: b.build, label: b.build, s: b.steps }))} />
                    </>
                  )}
                </>
              );
            })()}

            <p className="m-0 mt-6 text-[12px] text-fg-4">
              PostHog-Projekt „Klar Apps“, Funnel über <code>$app_name</code> {app.appName ?? app.label}, Tabellen über <code>app = {app.slug}</code>.
            </p>
          </>
        )}
      </div>
    </>
  );
}
