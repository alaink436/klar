// French convenience translation of /legal/affiliate-agreement (DE).
// The German version is the legally binding original. This FR page mirrors
// the section structure 1:1 so the onboarding (lang=fr) can point at a
// permanent URL for the long-form terms.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Conditions d'Affiliation · Klar",
  description: "Conditions du Programme d'Affiliation Klar. Version v1.0, en vigueur depuis le 21 mai 2026. Traduction de courtoisie en français; la version allemande est l'original juridiquement contraignant.",
  robots: { index: true, follow: true },
};

const VERSION = "v1.0";
const AS_OF = "21 mai 2026";

export default function AffiliateAgreementFrPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Affiliation · Conditions · {VERSION} · en vigueur depuis le {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Conditions d'<span className="editorial">Affiliation.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 12 }}>
          Ces conditions régissent la participation au Programme d'Affiliation Klar. En activant ton compte affilié sur la page d'onboarding, tu confirmes avoir lu et accepté ces conditions. L'adresse IP, le timestamp et le numéro de version sont enregistrés pour l'audit-trail.
        </p>
        <p className="t-body-lg" style={{ color: "var(--fg-3)", marginBottom: 48, fontSize: 14, lineHeight: 1.55 }}>
          <i>Note:</i> La{" "}
          <Link href="/legal/affiliate-agreement" className="underline">version allemande</Link>{" "}
          de ce contrat est l'original juridiquement contraignant. Cette traduction française est fournie à titre de courtoisie.
        </p>

        <Section n="01" title="Parties contractantes">
          <p>
            Le fournisseur de ce programme d'affiliation est <b>Alain Kessler</b>, entreprise individuelle ayant son siège en Suisse, joignable à{" "}
            <a href="mailto:alain@getklar.org" className="underline">alain@getklar.org</a>{" "}
            (ci-après <i>Klar</i>).
          </p>
          <p>
            La partie affiliée est la personne physique ou morale indiquée dans le formulaire d'onboarding (ci-après <i>l'Affilié</i>).
          </p>
        </Section>

        <Section n="02" title="Objet du programme">
          <p>
            Klar exploite six applications mobiles:{" "}
            <i>Yarn-Stash, ThrottleUp, On Wavelength, Kelva, Trubel</i> et{" "}
            <i>MyLoo</i>. L'Affilié reçoit un lien personnel de tracking par application. L'attribution se fait exclusivement via ce lien; aucun code promotionnel supplémentaire n'est émis ni requis. Lorsqu'un utilisateur référé via ce lien souscrit un abonnement Premium dans l'app ou déclenche une autre action payante, l'Affilié reçoit une commission selon le §3.
          </p>
        </Section>

        <Section n="03" title="Rémunération">
          <p>
            Pour chaque abonnement Premium, l'Affilié reçoit{" "}
            <b>un pourcentage des revenus mensuels de l'abonnement</b> pendant la{" "}
            <b>durée d'attribution à partir du premier achat</b>. Le pourcentage et la durée varient par application et sont affichés de manière transparente dans l'onboarding et dans le dashboard. La norme est de 50 pour cent pendant 24 mois; les écarts spécifiques à une application s'appliquent explicitement.
          </p>
          <p>
            Pour les applications avec un deuxième stream de revenus (Yarn-Stash: commissions shop Awin, Trubel: achats uniques d'album 4k), l'Affilié reçoit en plus une part de ce stream selon les conditions indiquées dans l'onboarding.
          </p>
          <p>
            <b>Retenue pour remboursement:</b> les commissions sont libérées pour le paiement 30 jours après l'événement de revenu. Les achats remboursés sont déduits nets avant paiement.
          </p>
          <p>
            <b>Paiement minimum:</b> 50 EUR ou USD. Les montants inférieurs passent au cycle mensuel suivant.
          </p>
        </Section>

        <Section n="04" title="Obligations de l'affilié">
          <p>
            L'Affilié s'engage à étiqueter clairement tout contenu lié à l'affiliation comme publicité (Suisse: LCD art. 3 lit. b; France: loi Hamon, code de la consommation; USA: FTC Endorsement Guides). Les étiquettes appropriées sont <i>Publicité</i>, <i>Partenariat rémunéré</i>, <i>#ad</i> ou les tags de paid-partnership spécifiques à la plateforme.
          </p>
          <p>
            Sont interdits: spam, cookie-stuffing, déclarations trompeuses sur les fonctionnalités de l'app, atteinte aux marques déposées, utilisation du lien de tracking dans des annonces payantes sur les mots-clés de marque Klar et l'auto-referral (achats via son propre lien de tracking). Les infractions entraînent la suspension immédiate du compte et la perte des commissions ouvertes.
          </p>
        </Section>

        <Section n="05" title="Tracking et protection des données">
          <p>
            L'attribution s'effectue côté serveur via un mécanisme de token signé (clipboard deferred deeplink sur iOS, install-referrer sur Android). Les données personnelles des utilisateurs référés ne sont pas transmises à l'Affilié; l'Affilié voit uniquement des métriques agrégées (clics, installations, achats) dans le dashboard. La base juridique est le RGPD ainsi que la LPD suisse.
          </p>
        </Section>

        <Section n="06" title="Paiement">
          <p>
            Les paiements sont effectués mensuellement, le premier du mois suivant, pour toutes les conversions qui sont à ce moment matures et non remboursées. Le paiement s'effectue exclusivement via Wise à l'adresse email indiquée dans l'onboarding. L'Affilié est responsable de l'indication correcte de ses coordonnées de paiement; les montants non livrables sont retenus jusqu'à disponibilité de données corrigées.
          </p>
          <p>
            Le statut fiscal (micro-entreprise, régime normal, particulier) est indiqué dans l'onboarding. Klar émet les notes de crédit correspondantes ou accepte les factures avec TVA mentionnée, selon le statut indiqué.
          </p>
        </Section>

        <Section n="07" title="Durée et résiliation">
          <p>
            Le contrat commence avec la confirmation de ces conditions dans l'onboarding et se poursuit pour une durée indéterminée. Les deux parties peuvent résilier à tout moment sans avoir à se justifier, par écrit via email à{" "}
            <a href="mailto:alain@getklar.org" className="underline">alain@getklar.org</a>{" "}
            ou à l'email d'affilié indiqué dans l'onboarding.
          </p>
          <p>
            Après résiliation, les commissions déjà acquises pour des abonnements encore actifs continuent d'être payées jusqu'à la fin de la durée d'attribution respective. Elles n'expirent pas.
          </p>
        </Section>

        <Section n="08" title="Responsabilité">
          <p>
            Klar ne répond que de la faute intentionnelle et de la faute grave. En cas de faute légère, la responsabilité est limitée à l'indemnisation des dommages prévisibles et typiques du contrat. Toute responsabilité pour manque à gagner résultant du volume d'abonnements escompté est exclue.
          </p>
        </Section>

        <Section n="09" title="Droit applicable et juridiction">
          <p>
            Le droit suisse est applicable, à l'exclusion de la Convention de l'ONU sur les contrats de vente internationale de marchandises. Le for compétent pour tous les litiges découlant ou en lien avec ce contrat est le siège de Klar en Suisse, dans la mesure où des dispositions impératives de protection du consommateur ne s'y opposent pas.
          </p>
        </Section>

        <Section n="10" title="Modifications, clause de sauvegarde">
          <p>
            Klar peut modifier ces conditions avec un préavis raisonnable (minimum 14 jours par email). Si l'Affilié s'oppose à la modification, il peut résilier sans préavis; les commissions déjà acquises restent acquises.
          </p>
          <p>
            Si une disposition de ce contrat devait être inefficace, le reste du contrat reste efficace. À la place de la disposition inefficace s'applique la régulation qui se rapproche le plus de la finalité économique.
          </p>
        </Section>

        <hr style={{ borderColor: "var(--line)", margin: "48px 0 24px", borderTop: "1px solid", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />

        <p style={{ fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.05em" }}>
          Version {VERSION} · En vigueur depuis le {AS_OF} · Fournisseur Alain Kessler (entreprise individuelle CH) ·{" "}
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
