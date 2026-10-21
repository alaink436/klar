// Klar Control · Modell.
//
// Das Rechenmodell hinter der Provision der Creator ohne Link (Spec
// creator-plattform, Ticket 05): die Rate (Anmeldungen pro 1000 Views), ob sie
// noch vom Prototyp kommt oder schon gelernt ist, die Grundlinie der letzten
// Woche gegen die echten Anmeldungen, der Mehrumsatz des Monats und ob der
// Deckel (40 %) greift. Darunter jeder Creator mit seiner Schaetzung. Gerechnet
// wird taeglich vom Cron /api/cron/creator-model, gelesen ueber
// src/lib/creatorEarnings.ts. Die Tabellen ohne Suchgriffe: sieben feste Tage
// und eine nach Provision sortierte Liste, und TabellenGriffe huellt sie sonst
// vor der Hydration ein (Hydration-Fehler im Dev-Server, 2026-10-21).

import { Calculator } from "lucide-react";
import { requireAdminPage } from "../../../lib/adminGuard";
import { latestModelRun, monthEarnings, usd } from "../../../lib/creatorEarnings";
import { CAP_SHARE, MIN_FIT_DAYS } from "../../../lib/creatorModel";
import { AdminTopbar } from "../AdminTopbar";
import { Kennzahlen } from "../Kennzahlen";
import { PageHeader } from "@/components/ui/page-header";
import { TextureCard } from "@/components/ui/texture-card";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const zahl = (n: number, stellen = 0) => n.toLocaleString("de-CH", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
const tag = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" });

export default async function ModellPage() {
  await requireAdminPage();
  const run = await latestModelRun();
  const creators = run ? await monthEarnings(run.month) : [];
  const woche = run?.days.slice(-7) ?? [];

  return (
    <>
      <title>Modell · Klar Control</title>
      <AdminTopbar titel="Modell" />
      <div className="content">
        <PageHeader eyebrow="Klar Studios" icon={<Calculator />} title="Modell">
          Wie viele Basalt-Anmeldungen die Posts der Creator ohne Link gebracht haben. Anmeldungen pro Stunde = Grundlinie (Tageszeit und
          Trend) + Rate × frische Views aller Basalt-Posts. Jeder Creator bekommt 50 % vom Umsatz seines Anteils, alle zusammen höchstens{" "}
          {CAP_SHARE * 100} % vom Mehrumsatz des Monats.
        </PageHeader>

        {!run ? (
          <TextureCard className="px-5 py-4 text-[13px] text-fg-2">Noch kein Lauf. Der Cron rechnet täglich um 04:30 UTC.</TextureCard>
        ) : (
          <>
            <Kennzahlen
              zahlen={[
                {
                  label: "Rate",
                  wert: zahl(run.rate_per_1000, 2),
                  zusatz:
                    run.rate_source === "fit"
                      ? `pro 1000 Views, gelernt aus ${run.days_of_data} Tagen`
                      : `pro 1000 Views, vom Prototyp bis ${MIN_FIT_DAYS} Tage View-Stände da sind (jetzt ${run.days_of_data})${
                          run.fitted_rate_per_1000 !== null ? `, gelernt wäre ${zahl(run.fitted_rate_per_1000, 2)}` : ""
                        }`,
                },
                {
                  label: "Anmeldungen im Monat",
                  wert: run.actual_signups,
                  zusatz: `Grundlinie ${zahl(run.baseline_signups, 1)}, also ${zahl(run.actual_signups - run.baseline_signups, 1)} durch Posts`,
                },
                {
                  label: "Umsatz pro Anmeldung",
                  wert: usd(run.revenue_per_signup_cents),
                  zusatz: `RevenueCat 28 Tage / neue Nutzer 30 Tage · Mehrumsatz ${usd(run.extra_revenue_cents)}`,
                },
                {
                  label: "Deckel greift",
                  wert: run.cap_factor < 1 ? "ja" : "nein",
                  zusatz:
                    run.cap_factor < 1
                      ? `alle auf ${zahl(run.cap_factor * 100)} % gekürzt, Deckel ${usd(run.cap_cents)}`
                      : `Provision ${usd(run.commission_cents)} von höchstens ${usd(run.cap_cents)}`,
                },
              ]}
            />

            <TextureCard className="mb-4 p-5">
              <h2 className="m-0">Grundlinie der Woche</h2>
              <p className="mt-1 text-[12.5px] text-fg-3">Lauf vom {tag(run.run_date)}. Tage in UTC, der heutige ist angebrochen.</p>
              <table data-klar-griffe="nein" className="mt-3 w-full text-[13px] tabular-nums">
                <thead className="text-left text-fg-3">
                  <tr>
                    <th className="py-1.5 font-normal">Tag</th>
                    <th className="py-1.5 text-right font-normal">Anmeldungen</th>
                    <th className="py-1.5 text-right font-normal">Grundlinie</th>
                    <th className="py-1.5 text-right font-normal">durch Posts</th>
                  </tr>
                </thead>
                <tbody>
                  {woche.map((d) => (
                    <tr key={d.d} className="border-t border-[var(--hair)]">
                      <td className="py-1.5">{tag(d.d)}</td>
                      <td className="py-1.5 text-right">{d.signups}</td>
                      <td className="py-1.5 text-right">{zahl(d.baseline, 1)}</td>
                      <td className="py-1.5 text-right">{zahl(d.signups - d.baseline, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TextureCard>

            <TextureCard className="p-5">
              <h2 className="m-0">Creator im Monat</h2>
              {creators.length === 0 ? (
                <p className="mt-2 text-[13px] text-fg-3">Noch kein Creator mit gezählten Posts in diesem Monat.</p>
              ) : (
                <table data-klar-griffe="nein" className="mt-3 w-full text-[13px] tabular-nums">
                  <thead className="text-left text-fg-3">
                    <tr>
                      <th className="py-1.5 font-normal">Creator</th>
                      <th className="py-1.5 text-right font-normal">Views</th>
                      <th className="py-1.5 text-right font-normal">Anmeldungen</th>
                      <th className="py-1.5 text-right font-normal">Provision</th>
                      <th className="py-1.5 text-right font-normal">nach Deckel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creators.map((c) => (
                      <tr key={c.creator_id} className="border-t border-[var(--hair)]">
                        <td className="py-1.5">@{c.handle}</td>
                        <td className="py-1.5 text-right">{zahl(c.views)}</td>
                        <td className="py-1.5 text-right">{zahl(c.est_signups, 1)}</td>
                        <td className="py-1.5 text-right">{usd(c.commission_cents)}</td>
                        <td className="py-1.5 text-right">{usd(c.payable_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </TextureCard>
          </>
        )}
      </div>
    </>
  );
}
