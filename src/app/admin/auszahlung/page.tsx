// Klar Control · Auszahlung.
//
// Was jeder Creator aus abgeschlossenen Monaten zugut hat (Spec
// creator-plattform, Ticket 06). Ab 25 USD und mit Wise-Daten gibt Alain jede
// Auszahlung einzeln frei; die App legt dann in Wise Empfaenger, Kurs und
// Ueberweisung an. Bezahlt (finanziert) wird die Ueberweisung in der Wise-App,
// weil Wise das mit einem persoenlichen Token in Europa nicht per API erlaubt.
// Unter 25 USD rollt der Betrag in den naechsten Monat. Geschrieben wird ueber
// /admin/auszahlung/save, gelesen ueber src/lib/payouts.ts.

import { Banknote } from "lucide-react";
import { requireAdminPage } from "../../../lib/adminGuard";
import { MIN_PAYOUT_CENTS, balances, listPayouts } from "../../../lib/payouts";
import { AdminTopbar } from "../AdminTopbar";
import { Kennzahlen } from "../Kennzahlen";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TextureCard } from "@/components/ui/texture-card";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const monat = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("de-CH", { month: "long", year: "numeric", timeZone: "UTC" }) : "-");
const STATUS = { sending: "läuft", sent: "in Wise angelegt, dort bezahlen", failed: "abgelehnt" } as const;

export default async function AuszahlungPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const [offen, verlauf] = await Promise.all([balances(), listPayouts()]);
  const bereit = offen.filter((b) => b.owedCents >= MIN_PAYOUT_CENTS);

  return (
    <>
      <title>Auszahlung · Klar Control</title>
      <AdminTopbar titel="Auszahlung" />
      <div className="content">
        <PageHeader eyebrow="Klar Studios" icon={<Banknote />} title="Auszahlung">
          Was die Creator aus abgeschlossenen Monaten zugut haben, nach Deckel und ohne abgelehnte Posts. Ab 25 USD gibst du jede Auszahlung
          frei, die App legt sie in Wise an, bezahlt wird sie in der Wise-App. Darunter rollt der Betrag in den nächsten Monat.
        </PageHeader>

        <Kennzahlen
          zahlen={[
            { label: "Bereit", wert: bereit.length, zusatz: `ab 25 USD, zusammen ${usd(bereit.reduce((n, b) => n + b.owedCents, 0))}` },
            { label: "Ohne Wise-Daten", wert: bereit.filter((b) => !b.wiseEmail).length, zusatz: "werden im Dashboard danach gefragt" },
            { label: "Rollt weiter", wert: offen.length - bereit.length, zusatz: "unter 25 USD" },
          ]}
        />

        <TextureCard className="mb-4 px-5 py-3.5 text-[12.5px] text-fg-2">
          Vor der ersten Auszahlung: Vertragstext (Schätzung, Methode, Deckel, Verstösse) und Auszahlung ins Ausland als Schweizer Einzelfirma klären,
          dazu im Klar-Vault einen Wise-Schlüssel mit base_url https://api.wise.com hinterlegen. Wise empfiehlt, Empfänger per E-Mail vorher bei
          ihnen freischalten zu lassen.
        </TextureCard>

        {sp.msg || sp.err ? <TextureCard className="mb-4 px-5 py-3.5 text-[12.5px] text-fg-2">{sp.err ?? sp.msg}</TextureCard> : null}

        <TextureCard className="mb-4 p-5">
          <h2 className="m-0">Offen</h2>
          {offen.length === 0 ? (
            <p className="mt-2 text-[13px] text-fg-3">Noch kein Creator hat in einem abgeschlossenen Monat etwas verdient.</p>
          ) : (
            <table data-klar-griffe="nein" className="mt-3 w-full text-[13px] tabular-nums">
              <thead className="text-left text-fg-3">
                <tr>
                  <th className="py-1.5 font-normal">Creator</th>
                  <th className="py-1.5 text-right font-normal">verdient</th>
                  <th className="py-1.5 text-right font-normal">ausbezahlt</th>
                  <th className="py-1.5 text-right font-normal">offen</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {offen.map((b) => (
                  <tr key={b.creatorId} className="border-t border-[var(--hair)]">
                    <td className="py-2">
                      @{b.handle}
                      <span className="block text-[12px] text-fg-3" title={b.wiseName ?? undefined}>
                        bis {monat(b.throughMonth)} · {b.wiseEmail ?? "Wise fehlt"}
                      </span>
                    </td>
                    <td className="py-2 text-right">{usd(b.earnedCents)}</td>
                    <td className="py-2 text-right">{usd(b.paidCents)}</td>
                    <td className="py-2 text-right">{usd(b.owedCents)}</td>
                    <td className="py-2 pl-3 text-right">
                      {b.owedCents >= MIN_PAYOUT_CENTS && b.wiseEmail ? (
                        <form action="/admin/auszahlung/save" method="post">
                          <input type="hidden" name="creator" value={b.creatorId} />
                          <Button type="submit" variant="pill-dark">
                            Freigeben
                          </Button>
                        </form>
                      ) : (
                        <span className="text-fg-3">{b.owedCents < MIN_PAYOUT_CENTS ? "rollt weiter" : "wartet auf Wise-Daten"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TextureCard>

        <TextureCard className="p-5">
          <h2 className="m-0">Verlauf</h2>
          {verlauf.length === 0 ? (
            <p className="mt-2 text-[13px] text-fg-3">Noch keine Auszahlung.</p>
          ) : (
            <table data-klar-griffe="nein" className="mt-3 w-full text-[13px] tabular-nums">
              <tbody>
                {verlauf.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--hair)] first:border-t-0">
                    <td className="py-2">{new Date(p.created_at).toLocaleDateString("de-CH")}</td>
                    <td className="py-2">@{p.handle}</td>
                    <td className="py-2 text-right">{usd(p.amount_cents)}</td>
                    <td className="py-2 pl-3">
                      {STATUS[p.status]}
                      <span className="block text-[12px] text-fg-3">{p.wise_transfer_id ? `Wise ${p.wise_transfer_id}` : (p.error ?? "")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TextureCard>
      </div>
    </>
  );
}
