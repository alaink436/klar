// Spanish convenience translation of /legal/affiliate-agreement (DE).
// The German version is the legally binding original. This ES page mirrors
// the section structure 1:1 so the onboarding (lang=es) can point at a
// permanent URL for the long-form terms.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Condiciones de Afiliado · Klar",
  description: "Condiciones del Programa de Afiliados Klar. Versión v1.0, a fecha del 21 de mayo de 2026. Traducción de cortesía al español; la versión alemana es el original legalmente vinculante.",
  robots: { index: true, follow: true },
};

const VERSION = "v1.0";
const AS_OF = "21 de mayo de 2026";

export default function AffiliateAgreementEsPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Afiliado · Condiciones · {VERSION} · a fecha del {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Condiciones de <span className="editorial">Afiliado.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 12 }}>
          Estas condiciones regulan la participación en el Programa de Afiliados Klar. Al activar tu cuenta de afiliado en la página de onboarding confirmas haber leído y aceptado estas condiciones. Se guarda dirección IP, timestamp y número de versión para el audit-trail.
        </p>
        <p className="t-body-lg" style={{ color: "var(--fg-3)", marginBottom: 48, fontSize: 14, lineHeight: 1.55 }}>
          <i>Nota:</i> La{" "}
          <Link href="/legal/affiliate-agreement" className="underline">versión alemana</Link>{" "}
          de este contrato es el original legalmente vinculante. Esta traducción al español se proporciona por cortesía.
        </p>

        <Section n="01" title="Partes contratantes">
          <p>
            El proveedor de este programa de afiliados es <b>Alain Kessler</b>, empresa individual con sede en Suiza, contactable en{" "}
            <a href="mailto:alain@getklar.org" className="underline">alain@getklar.org</a>{" "}
            (en adelante <i>Klar</i>).
          </p>
          <p>
            La parte afiliada es la persona física o jurídica indicada en el formulario de onboarding (en adelante <i>Afiliado</i>).
          </p>
        </Section>

        <Section n="02" title="Objeto del programa">
          <p>
            Klar opera seis apps móviles:{" "}
            <i>Yarn-Stash, ThrottleUp, On Wavelength, Kelva, Trubel</i> y{" "}
            <i>MyLoo</i>. El Afiliado recibe un enlace personal de tracking por app. La atribución se realiza exclusivamente a través de este enlace; no se emite ni requiere ningún código promocional adicional. Cuando un usuario referido a través de este enlace contrata una suscripción Premium en la app o desencadena otra acción de pago, el Afiliado recibe una comisión según §3.
          </p>
        </Section>

        <Section n="03" title="Compensación">
          <p>
            Por cada suscripción Premium el Afiliado recibe{" "}
            <b>un porcentaje de los ingresos mensuales de la suscripción</b> durante la{" "}
            <b>duración de atribución desde la primera compra</b>. El porcentaje y la duración varían por app y se muestran de forma transparente en el onboarding y en el dashboard. El estándar es el 50 por ciento durante 24 meses; las desviaciones por app aplican explícitamente.
          </p>
          <p>
            Para apps con un segundo stream de ingresos (Yarn-Stash: comisiones de tienda Awin, Trubel: compras únicas de álbum 4k) el Afiliado recibe adicionalmente una parte de ese stream según las condiciones indicadas en el onboarding.
          </p>
          <p>
            <b>Retención por reembolso:</b> las comisiones se liberan para el pago 30 días después del evento de ingresos. Las compras reembolsadas se deducen netas antes del pago.
          </p>
          <p>
            <b>Pago mínimo:</b> 50 EUR o USD. Los importes inferiores se trasladan al siguiente ciclo mensual.
          </p>
        </Section>

        <Section n="04" title="Obligaciones del afiliado">
          <p>
            El Afiliado se compromete a etiquetar claramente todo el contenido relacionado con la afiliación como publicidad (Suiza: UWG Art. 3 lit. b; Alemania: UWG §5a apdo. 4; EE. UU.: FTC Endorsement Guides). Etiquetas adecuadas son <i>Publicidad</i>, <i>Anuncio</i>, <i>#ad</i> o etiquetas de paid-partnership específicas de la plataforma.
          </p>
          <p>
            Están prohibidos: spam, cookie-stuffing, declaraciones engañosas sobre la funcionalidad de la app, infracción de marcas registradas, el uso del enlace de tracking en anuncios de pago sobre los keywords de marca Klar y la auto-referencia (compras a través del propio enlace de tracking). Las infracciones conllevan la suspensión inmediata de la cuenta y la pérdida de las comisiones abiertas.
          </p>
        </Section>

        <Section n="05" title="Tracking y protección de datos">
          <p>
            La atribución se realiza en el servidor mediante un mecanismo de token firmado (clipboard deferred deeplink en iOS, install-referrer en Android). Los datos personales de los usuarios referidos no se transmiten al Afiliado; el Afiliado solo ve métricas agregadas (clicks, instalaciones, compras) en el dashboard. La base legal es el RGPD así como la DSG suiza.
          </p>
        </Section>

        <Section n="06" title="Pago">
          <p>
            Los pagos se realizan mensualmente, el día primero del mes siguiente, para todas las conversiones que para entonces estén maduras y no reembolsadas. El pago se realiza exclusivamente a través de Wise a la dirección de email indicada en el onboarding. El Afiliado es responsable de la correcta indicación de sus datos de pago; los importes no entregables se retienen hasta disponer de datos corregidos.
          </p>
          <p>
            El estatus fiscal (régimen simplificado, régimen general, persona privada) se indica en el onboarding. Klar emite las correspondientes notas de abono o acepta facturas con IVA declarado, según el estatus indicado.
          </p>
        </Section>

        <Section n="07" title="Duración y rescisión">
          <p>
            El contrato comienza con la confirmación de estas condiciones en el onboarding y se prolonga por tiempo indefinido. Ambas partes pueden rescindir en cualquier momento sin necesidad de justificación, por escrito vía email a{" "}
            <a href="mailto:alain@getklar.org" className="underline">alain@getklar.org</a>{" "}
            o al email de afiliado indicado en el onboarding.
          </p>
          <p>
            Tras la rescisión, las comisiones ya ganadas por suscripciones aún activas se siguen pagando hasta el final de la respectiva duración de atribución. No caducan.
          </p>
        </Section>

        <Section n="08" title="Responsabilidad">
          <p>
            Klar solo responde por dolo y culpa grave. En caso de culpa leve, la responsabilidad se limita a la indemnización de daños previsibles y típicos del contrato. Queda excluida la responsabilidad por lucro cesante derivado del volumen de suscripciones esperado.
          </p>
        </Section>

        <Section n="09" title="Derecho aplicable y jurisdicción">
          <p>
            Es aplicable el derecho suizo, excluida la Convención de la ONU sobre Compraventa Internacional de Mercaderías. La jurisdicción para todas las disputas derivadas de o relacionadas con este contrato es el domicilio de Klar en Suiza, en la medida en que disposiciones imperativas de protección al consumidor no permitan lo contrario.
          </p>
        </Section>

        <Section n="10" title="Modificaciones, cláusula de salvaguarda">
          <p>
            Klar puede modificar estas condiciones con preaviso razonable (mínimo 14 días por email). Si el Afiliado se opone a la modificación, puede rescindir sin preaviso; las comisiones ya ganadas se mantienen.
          </p>
          <p>
            Si alguna disposición de este contrato fuera ineficaz, el resto del contrato permanece eficaz. En lugar de la disposición ineficaz se aplica la regulación que se acerque más a la finalidad económica.
          </p>
        </Section>

        <hr style={{ borderColor: "var(--line)", margin: "48px 0 24px", borderTop: "1px solid", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />

        <p style={{ fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.05em" }}>
          Versión {VERSION} · A fecha del {AS_OF} · Proveedor Alain Kessler (empresa individual CH) ·{" "}
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
