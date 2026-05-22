// English convenience translation of /legal/affiliate-agreement (DE).
// The German version is the legally binding original. This EN page mirrors
// the section structure 1:1 so the PDF agreement (lang=en) can point at a
// permanent URL for the long-form terms.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Affiliate Terms · Klar",
  description: "Terms and conditions for the Klar Affiliate Program. Version v1.0, as of 21 May 2026. English convenience translation; the German version is the legally binding original.",
  robots: { index: true, follow: true },
};

const VERSION = "v1.0";
const AS_OF = "21 May 2026";

export default function AffiliateAgreementEnPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Affiliate · Terms · {VERSION} · as of {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Affiliate <span className="editorial">Terms.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 12 }}>
          These terms govern participation in the Klar Affiliate Program. By
          activating your affiliate account on the onboarding page, you confirm
          that you have read and accepted these terms. IP address, timestamp
          and version number are recorded for the audit trail.
        </p>
        <p className="t-body-lg" style={{ color: "var(--fg-3)", marginBottom: 48, fontSize: 14, lineHeight: 1.55 }}>
          <i>Note:</i> The{" "}
          <Link href="/legal/affiliate-agreement" className="underline">German version</Link>{" "}
          of this agreement is the legally binding original. This English
          translation is provided for convenience.
        </p>

        <Section n="01" title="Contracting Parties">
          <p>
            The provider of this affiliate program is <b>Alain Kessler</b>, a
            sole proprietorship registered in Switzerland, reachable at{" "}
            <a href="mailto:alain@getklar.org" className="underline">alain@getklar.org</a>{" "}
            (hereinafter <i>Klar</i>).
          </p>
          <p>
            The contracting affiliate is the natural or legal person specified
            in the onboarding form (hereinafter <i>Affiliate</i>).
          </p>
        </Section>

        <Section n="02" title="Program Scope">
          <p>
            Klar operates six mobile apps:{" "}
            <i>Yarn-Stash, ThrottleUp, On Wavelength, Kelva, Trubel</i> and{" "}
            <i>MyLoo</i>. The Affiliate receives a personal tracking link per
            app. Attribution runs exclusively through this link; no additional
            promo code is issued or required. When a user referred via this
            link signs up for a Premium subscription or triggers another paid
            action in the app, the Affiliate earns a commission under §3.
          </p>
        </Section>

        <Section n="03" title="Compensation">
          <p>
            Per Premium subscription the Affiliate receives a{" "}
            <b>percentage share of the monthly subscription revenue</b> for the
            <b> attribution duration starting from the first purchase</b>.
            Share and duration differ per app and are transparently disclosed
            during onboarding and in the dashboard. Standard is 50 percent for
            24 months; app-specific deviations apply explicitly.
          </p>
          <p>
            For apps with a second revenue stream (Yarn-Stash: Awin shop
            commissions, Trubel: 4k album one-time purchases) the Affiliate
            additionally receives a share of that stream according to the
            conditions disclosed during onboarding.
          </p>
          <p>
            <b>Refund holdback:</b> commissions are released for payout 30 days
            after the revenue event. Refunded purchases are deducted net before
            payout.
          </p>
          <p>
            <b>Minimum payout:</b> 50 EUR or USD. Smaller amounts carry over
            into the next monthly run.
          </p>
        </Section>

        <Section n="04" title="Affiliate Obligations">
          <p>
            The Affiliate undertakes to clearly label all affiliate-related
            content as advertising (Switzerland: UWG Art. 3 lit. b; Germany:
            UWG §5a para. 4; USA: FTC Endorsement Guides). Suitable labels
            include <i>advertising</i>, <i>ad</i>, <i>#ad</i> or platform-specific
            paid-partnership badges.
          </p>
          <p>
            Prohibited: spam, cookie stuffing, misleading statements about app
            functionality, trademark infringement, the use of the tracking link
            in paid ads on Klar brand keywords, and self-referral (purchases
            through one&apos;s own tracking link). Violations lead to immediate
            account suspension and forfeiture of open commissions.
          </p>
        </Section>

        <Section n="05" title="Tracking and Data Protection">
          <p>
            Attribution runs server-side through a signed token mechanism
            (clipboard deferred deeplink on iOS, install referrer on Android).
            Personal data of referred users is not transmitted to the Affiliate;
            the Affiliate only sees aggregated metrics (clicks, installs,
            purchases) in the dashboard. Legal basis is the GDPR and the Swiss
            DSG.
          </p>
        </Section>

        <Section n="06" title="Payout">
          <p>
            Payouts happen monthly, on the first of the following month, for
            all conversions that are mature and not refunded by then. Payouts
            are made exclusively via Wise to the email address provided
            during onboarding. The Affiliate is responsible for correct
            payment information; non-deliverable amounts are held back until
            corrected data is provided.
          </p>
          <p>
            Tax status (small-business, regular taxation, private individual)
            is declared during onboarding. Klar issues corresponding
            self-billed credit notes or accepts invoices with declared VAT,
            depending on the declared status.
          </p>
        </Section>

        <Section n="07" title="Term and Termination">
          <p>
            The contract begins with confirmation of these terms during
            onboarding and runs indefinitely. Both parties may terminate at any
            time without giving reasons, in writing by email to{" "}
            <a href="mailto:alain@getklar.org" className="underline">alain@getklar.org</a>{" "}
            or to the affiliate email registered during onboarding.
          </p>
          <p>
            After termination, already-earned commissions for still-active
            subscriptions continue to be paid out until the end of the
            respective attribution duration. They do not lapse.
          </p>
        </Section>

        <Section n="08" title="Liability">
          <p>
            Klar is liable only for intent and gross negligence. For light
            negligence, liability is limited to foreseeable, contract-typical
            damages. Liability for lost profit from expected subscription
            volume is excluded.
          </p>
        </Section>

        <Section n="09" title="Applicable Law and Jurisdiction">
          <p>
            Swiss law applies, excluding the UN Convention on Contracts for
            the International Sale of Goods. Jurisdiction for all disputes
            arising from or in connection with this contract is the domicile
            of Klar in Switzerland, unless mandatory consumer-protection
            provisions stipulate otherwise.
          </p>
        </Section>

        <Section n="10" title="Amendments, Severability">
          <p>
            Klar may amend these terms with reasonable advance notice (at least
            14 days by email). If the Affiliate objects to the amendment, the
            Affiliate may terminate without notice; already-earned commissions
            remain unaffected.
          </p>
          <p>
            If any provision of this contract is invalid, the remainder of the
            contract stays valid. Instead of the invalid provision, the
            regulation that most closely matches the economic purpose applies.
          </p>
        </Section>

        <hr style={{ borderColor: "var(--line)", margin: "48px 0 24px", borderTop: "1px solid", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />

        <p style={{ fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.05em" }}>
          Version {VERSION} · As of {AS_OF} · Provider Alain Kessler (CH sole proprietorship) ·{" "}
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
