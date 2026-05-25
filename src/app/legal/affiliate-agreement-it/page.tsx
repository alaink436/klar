// Italian convenience translation of /legal/affiliate-agreement (DE).
// The German version is the legally binding original. This IT page mirrors
// the section structure 1:1 so the onboarding (lang=it) can point at a
// permanent URL for the long-form terms.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Condizioni di Affiliazione · Klar",
  description: "Condizioni del Programma di Affiliazione Klar. Versione v1.0, in vigore dal 21 maggio 2026. Traduzione di cortesia in italiano; la versione tedesca è l'originale legalmente vincolante.",
  robots: { index: true, follow: true },
};

const VERSION = "v1.0";
const AS_OF = "21 maggio 2026";

export default function AffiliateAgreementItPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Affiliazione · Condizioni · {VERSION} · in vigore dal {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Condizioni di <span className="editorial">Affiliazione.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 12 }}>
          Queste condizioni regolano la partecipazione al Programma di Affiliazione Klar. Attivando il tuo account di affiliato nella pagina di onboarding confermi di aver letto e accettato queste condizioni. Vengono salvati indirizzo IP, timestamp e numero di versione per l'audit-trail.
        </p>
        <p className="t-body-lg" style={{ color: "var(--fg-3)", marginBottom: 48, fontSize: 14, lineHeight: 1.55 }}>
          <i>Nota:</i> La{" "}
          <Link href="/legal/affiliate-agreement" className="underline">versione tedesca</Link>{" "}
          di questo contratto è l'originale legalmente vincolante. Questa traduzione in italiano è fornita per cortesia.
        </p>

        <Section n="01" title="Parti contraenti">
          <p>
            Il fornitore di questo programma di affiliazione è <b>Alain Kessler</b>, ditta individuale con sede in Svizzera, contattabile a{" "}
            <a href="mailto:alain@getklar.org" className="underline">alain@getklar.org</a>{" "}
            (di seguito <i>Klar</i>).
          </p>
          <p>
            La parte affiliata è la persona fisica o giuridica indicata nel modulo di onboarding (di seguito <i>Affiliato</i>).
          </p>
        </Section>

        <Section n="02" title="Oggetto del programma">
          <p>
            Klar gestisce sei app mobili:{" "}
            <i>Yarn-Stash, ThrottleUp, On Wavelength, Kelva, Trubel</i> e{" "}
            <i>MyLoo</i>. L'Affiliato riceve un link personale di tracking per ciascuna app. L'attribuzione avviene esclusivamente tramite questo link; non viene emesso né richiesto alcun codice promozionale aggiuntivo. Quando un utente referenziato tramite questo link sottoscrive un abbonamento Premium nell'app o attiva un'altra azione di pagamento, l'Affiliato riceve una commissione secondo §3.
          </p>
        </Section>

        <Section n="03" title="Compensi">
          <p>
            Per ogni abbonamento Premium l'Affiliato riceve{" "}
            <b>una percentuale dei ricavi mensili dell'abbonamento</b> per la{" "}
            <b>durata di attribuzione dal primo acquisto</b>. La percentuale e la durata variano per app e sono mostrate in modo trasparente nell'onboarding e nella dashboard. Lo standard è il 50 percento per 24 mesi; eventuali deviazioni per singola app si applicano esplicitamente.
          </p>
          <p>
            Per app con un secondo stream di entrate (Yarn-Stash: commissioni shop Awin, Trubel: acquisti una tantum di album 4k) l'Affiliato riceve in aggiunta una quota di quello stream secondo le condizioni indicate nell'onboarding.
          </p>
          <p>
            <b>Trattenuta per rimborso:</b> le commissioni vengono liberate per il pagamento 30 giorni dopo l'evento di ricavo. Gli acquisti rimborsati vengono dedotti netti prima del pagamento.
          </p>
          <p>
            <b>Pagamento minimo:</b> 50 EUR o USD. Gli importi inferiori passano al ciclo mensile successivo.
          </p>
        </Section>

        <Section n="04" title="Obblighi dell'affiliato">
          <p>
            L'Affiliato si impegna a etichettare chiaramente tutti i contenuti legati all'affiliazione come pubblicità (Svizzera: LCSl art. 3 lit. b; Italia: D.Lgs. 145/2007 e codice del consumo; USA: FTC Endorsement Guides). Etichette adatte sono <i>Pubblicità</i>, <i>Sponsorizzato</i>, <i>#ad</i> o tag di paid-partnership specifici della piattaforma.
          </p>
          <p>
            Sono vietati: spam, cookie-stuffing, dichiarazioni ingannevoli sulle funzionalità dell'app, violazione di marchi registrati, l'uso del link di tracking in annunci a pagamento sulle keyword di marchio Klar e l'auto-referral (acquisti tramite il proprio link di tracking). Le violazioni comportano la sospensione immediata dell'account e la perdita delle commissioni aperte.
          </p>
        </Section>

        <Section n="05" title="Tracking e protezione dei dati">
          <p>
            L'attribuzione avviene lato server tramite un meccanismo di token firmato (clipboard deferred deeplink su iOS, install-referrer su Android). I dati personali degli utenti referenziati non vengono trasmessi all'Affiliato; l'Affiliato vede solo metriche aggregate (click, installazioni, acquisti) nella dashboard. Base giuridica è il GDPR così come la LPD svizzera.
          </p>
        </Section>

        <Section n="06" title="Pagamento">
          <p>
            I pagamenti vengono effettuati ogni mese, il primo del mese successivo, per tutte le conversioni che a quel momento siano mature e non rimborsate. Il pagamento avviene esclusivamente tramite Wise all'indirizzo email indicato nell'onboarding. L'Affiliato è responsabile della corretta indicazione dei propri dati di pagamento; gli importi non recapitabili vengono trattenuti fino alla disponibilità di dati corretti.
          </p>
          <p>
            Lo stato fiscale (regime forfettario, regime ordinario, persona privata) viene indicato nell'onboarding. Klar emette le corrispondenti note di accredito o accetta fatture con IVA esposta, a seconda dello stato indicato.
          </p>
        </Section>

        <Section n="07" title="Durata e recesso">
          <p>
            Il contratto inizia con la conferma di queste condizioni nell'onboarding e si protrae a tempo indeterminato. Entrambe le parti possono recedere in qualsiasi momento senza necessità di giustificazione, per iscritto via email a{" "}
            <a href="mailto:alain@getklar.org" className="underline">alain@getklar.org</a>{" "}
            o all'email di affiliato indicata nell'onboarding.
          </p>
          <p>
            Dopo il recesso, le commissioni già maturate per abbonamenti ancora attivi vengono comunque pagate fino al termine della rispettiva durata di attribuzione. Non scadono.
          </p>
        </Section>

        <Section n="08" title="Responsabilità">
          <p>
            Klar risponde solo per dolo e colpa grave. In caso di colpa lieve, la responsabilità è limitata al risarcimento dei danni prevedibili e tipici del contratto. È esclusa la responsabilità per lucro cessante derivante dal volume di abbonamenti atteso.
          </p>
        </Section>

        <Section n="09" title="Diritto applicabile e foro">
          <p>
            Si applica il diritto svizzero, esclusa la Convenzione ONU sulla vendita internazionale di beni mobili. Il foro competente per tutte le controversie derivanti da o relative a questo contratto è la sede di Klar in Svizzera, nella misura in cui norme imperative di tutela del consumatore non dispongano diversamente.
          </p>
        </Section>

        <Section n="10" title="Modifiche, clausola di salvaguardia">
          <p>
            Klar può modificare queste condizioni con preavviso ragionevole (minimo 14 giorni via email). Se l'Affiliato si oppone alla modifica, può recedere senza preavviso; le commissioni già maturate restano valide.
          </p>
          <p>
            Se una disposizione di questo contratto risultasse inefficace, il resto del contratto rimane efficace. Al posto della disposizione inefficace si applica la regolamentazione che si avvicina di più alla finalità economica.
          </p>
        </Section>

        <hr style={{ borderColor: "var(--line)", margin: "48px 0 24px", borderTop: "1px solid", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />

        <p style={{ fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.05em" }}>
          Versione {VERSION} · In vigore dal {AS_OF} · Fornitore Alain Kessler (ditta individuale CH) ·{" "}
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
