// Affiliate-Agreement — click-through terms displayed under the checkbox on
// Step 3 of the onboarding. Visible URL: getklar.org/legal/affiliate-agreement.
// Inherits the public-site fonts (Space Grotesk, Fraunces, Manrope) from
// the root layout and uses globals.css tokens directly.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Affiliate-Bedingungen · Klar",
  description: "Vertragsbedingungen für das Klar Affiliate-Programm. Stand 2026-05-21, Version v1.0.",
  robots: { index: true, follow: true },
};

const VERSION = "v1.0";
const STAND = "21. Mai 2026";

export default function AffiliateAgreementPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Affiliate · Vertragsbedingungen · {VERSION} · Stand {STAND}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Affiliate-<span className="editorial">Bedingungen.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 48 }}>
          Diese Bedingungen regeln die Teilnahme am Klar Affiliate-Programm.
          Mit der Aktivierung deines Affiliate-Accounts auf der Onboarding-Seite
          bestätigst du, dass du diese Bedingungen gelesen und akzeptiert hast.
          IP-Adresse, Zeitstempel und Versionsnummer werden für den Audit-Trail
          gespeichert.
        </p>

        <Section n="01" title="Vertragspartner">
          <p>
            Anbieter dieses Affiliate-Programms ist <b>Alain Kessler</b>, Einzelfirma
            mit Sitz in der Schweiz, erreichbar unter{" "}
            <a href="mailto:alain@getklar.org" className="underline">alain@getklar.org</a>{" "}
            (im Folgenden <i>Klar</i>).
          </p>
          <p>
            Vertragspartner als Affiliate ist die im Onboarding-Formular angegebene
            natürliche oder juristische Person (im Folgenden <i>Affiliate</i>).
          </p>
        </Section>

        <Section n="02" title="Programm-Gegenstand">
          <p>
            Klar betreibt sechs mobile Apps:{" "}
            <i>Yarn-Stash, ThrottleUp, On Wavelength, Kelva, Trubel</i> und{" "}
            <i>MyLoo</i>. Der Affiliate erhält pro App einen persönlichen
            Tracking-Link und einen Promo-Code. Wenn ein über diesen Link oder
            Code referrierter Nutzer in der App ein Premium-Abo abschließt oder
            eine andere zahlungspflichtige Aktion auslöst, erhält der Affiliate
            eine Provision gemäß §3.
          </p>
        </Section>

        <Section n="03" title="Vergütung">
          <p>
            Pro Premium-Sub bekommt der Affiliate{" "}
            <b>einen prozentualen Anteil der monatlichen Sub-Einnahmen</b> für
            die <b>Attributions-Dauer ab erstem Kauf</b>. Anteil und Dauer
            unterscheiden sich pro App und sind im Onboarding und im Dashboard
            transparent ausgewiesen. Standard ist 50 Prozent für 24 Monate;
            App-spezifische Abweichungen gelten ausdrücklich.
          </p>
          <p>
            Für Apps mit zweitem Revenue-Stream (Yarn-Stash:
            Awin-Shop-Provisionen, Trubel: 4k-Album-One-Time-Käufe) erhält der
            Affiliate zusätzlich einen Anteil an diesem Stream gemäß den im
            Onboarding ausgewiesenen Konditionen.
          </p>
          <p>
            <b>Refund-Holdback:</b> Provisionen werden 30 Tage nach dem
            Umsatz-Event zur Auszahlung freigegeben. Zurückerstattete Käufe
            werden vor Auszahlung netto abgezogen.
          </p>
          <p>
            <b>Mindestauszahlung:</b> 50 EUR oder USD. Beträge darunter werden
            als Carry-over in den nächsten Monatslauf übernommen.
          </p>
        </Section>

        <Section n="04" title="Pflichten des Affiliates">
          <p>
            Der Affiliate verpflichtet sich, alle Inhalte mit Affiliate-Bezug
            klar als Werbung zu kennzeichnen (Schweiz: UWG Art. 3 lit. b;
            Deutschland: UWG §5a Abs. 4; USA: FTC Endorsement Guides).
            Geeignete Kennzeichnungen sind <i>Werbung</i>, <i>Anzeige</i>,
            <i>#ad</i> oder Plattform-eigene Paid-Partnership-Labels.
          </p>
          <p>
            Untersagt sind: Spam, Cookie-Stuffing, irreführende Aussagen über
            die App-Funktionalität, Markenrechtsverletzungen, der Einsatz des
            Tracking-Links in Paid-Ads auf den Klar-Marken-Keywords sowie
            Self-Referral (Käufe über den eigenen Tracking-Link).
            Verstöße führen zu sofortiger Aussetzung des Accounts und zum
            Verfall offener Provisionen.
          </p>
        </Section>

        <Section n="05" title="Tracking und Datenschutz">
          <p>
            Die Attribution erfolgt server-seitig über einen signierten
            Token-Mechanismus (Clipboard-Deferred-Deeplink auf iOS,
            Install-Referrer auf Android). Personenbezogene Daten der
            referrierten Nutzer werden nicht an den Affiliate übermittelt;
            er sieht ausschließlich aggregierte Metriken (Klicks, Installs,
            Käufe) im Dashboard. Datenschutzgrundlage ist die DSGVO sowie das
            Schweizer DSG.
          </p>
        </Section>

        <Section n="06" title="Auszahlung">
          <p>
            Auszahlungen erfolgen monatlich, jeweils zum Ersten des Folgemonats,
            für alle bis dahin reifen und nicht zurückerstatteten Conversions.
            Auszahlungsmethode wird im Onboarding gewählt: PayPal, Wise
            oder SEPA. Der Affiliate ist für die korrekte Angabe seiner
            Zahlungsinformationen verantwortlich; nicht zustellbare Beträge
            werden zurückgehalten, bis korrigierte Daten vorliegen.
          </p>
          <p>
            Steuerstatus (Kleinunternehmer, regelbesteuert, Privatperson) wird
            im Onboarding angegeben. Klar erstellt entsprechende Gutschriften
            oder akzeptiert Rechnungen mit ausgewiesener MwSt, je nach
            angegebenem Status.
          </p>
        </Section>

        <Section n="07" title="Laufzeit, Kündigung">
          <p>
            Der Vertrag beginnt mit der Bestätigung dieser Bedingungen im
            Onboarding und läuft auf unbestimmte Zeit. Beide Parteien können
            jederzeit ohne Angabe von Gründen kündigen, schriftlich per E-Mail
            an <a href="mailto:alain@getklar.org" className="underline">alain@getklar.org</a>{" "}
            bzw. an die im Onboarding angegebene Affiliate-E-Mail.
          </p>
          <p>
            Nach Kündigung werden bereits verdiente Provisionen für noch
            aktive Subscriptions bis zum Ende der jeweiligen Attributions-Dauer
            weiter ausgezahlt. Sie verfallen nicht.
          </p>
        </Section>

        <Section n="08" title="Haftung">
          <p>
            Klar haftet nur für Vorsatz und grobe Fahrlässigkeit. Bei
            leichter Fahrlässigkeit ist die Haftung auf den Ersatz vorhersehbarer,
            vertragstypischer Schäden begrenzt. Eine Haftung für entgangenen
            Gewinn aus erwartetem Sub-Volumen ist ausgeschlossen.
          </p>
        </Section>

        <Section n="09" title="Anwendbares Recht und Gerichtsstand">
          <p>
            Es gilt schweizerisches Recht unter Ausschluss des UN-Kaufrechts.
            Gerichtsstand für alle Streitigkeiten aus oder im Zusammenhang mit
            diesem Vertrag ist der Wohnsitz von Klar in der Schweiz, sofern
            zwingende Verbraucherschutzvorschriften nichts Gegenteiliges
            erlauben.
          </p>
        </Section>

        <Section n="10" title="Änderungen, Salvatorische Klausel">
          <p>
            Klar darf diese Bedingungen mit angemessener Vorankündigung (mindestens
            14 Tage per E-Mail) ändern. Widerspricht der Affiliate der Änderung,
            kann er fristlos kündigen; bereits verdiente Provisionen bleiben
            erhalten.
          </p>
          <p>
            Sollte eine Bestimmung dieses Vertrags unwirksam sein, bleibt der
            Rest des Vertrags wirksam. Anstelle der unwirksamen Bestimmung
            gilt diejenige Regelung, die dem wirtschaftlichen Zweck am
            nächsten kommt.
          </p>
        </Section>

        <hr style={{ borderColor: "var(--line)", margin: "48px 0 24px", borderTop: "1px solid", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />

        <p style={{ fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.05em" }}>
          Version {VERSION} · Stand {STAND} · Anbieter Alain Kessler (CH Einzelfirma) ·{" "}
          <Link href="/" className="underline">getklar.org</Link>
        </p>
      </article>
    </main>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 14 }}>
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-3)" }}>{n}</span>
        <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 700, fontSize: "clamp(22px, 3vw, 28px)", letterSpacing: "-0.02em", color: "var(--fg)", margin: 0 }}>{title}</h2>
      </div>
      <div style={{ fontSize: 15.5, lineHeight: 1.62, color: "var(--fg-2)", display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </section>
  );
}
