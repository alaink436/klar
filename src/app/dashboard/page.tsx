// Main affiliate dashboard. Auth-required: middleware refreshes the session
// cookie, and we redirect to /dashboard/login if there is no user. Once
// signed in we look up the klar_affiliates row (apps + handles) and pull
// earnings + funnel from each app's Supabase in parallel. Cached 60s so a
// rapid back-and-forth between tabs doesn't burn requests.

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser, serviceSupabase, isSupabaseConfigured } from "@/lib/supabaseAuth";
import { getApp, sbGet } from "@/lib/adminApps";
import { ensureAffiliate } from "@/lib/ensureAffiliate";

export const dynamic = "force-dynamic";

const APP_NAME: Record<string, string> = {
  wavelength: "Wavelength",
  kelva: "Kelva",
  trubel: "Trubel",
  myloo: "MyLoo",
  "yarn-stash": "Yarn-Stash",
  moto: "ThrottleUp",
};

interface AffiliateRow {
  user_id: string;
  email: string;
  display_name: string | null;
  apps: string[];
  handles: Record<string, string>;
  status: "active" | "cancelled";
  cancelled_at: string | null;
}

interface AppStats {
  slug: string;
  appName: string;
  handle: string;
  matured_cents: number;
  paid_cents: number;
  claimable_cents: number;
  clicks: number;
  installs: number;
  conversions: number;
}

async function loadAffiliate(userId: string): Promise<AffiliateRow | null> {
  const svc = serviceSupabase();
  const { data } = await svc
    .from("klar_affiliates")
    .select("user_id, email, display_name, apps, handles, status, cancelled_at")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as AffiliateRow) ?? null;
}

async function loadStatsForApp(slug: string, handle: string): Promise<AppStats | null> {
  const app = getApp(slug);
  if (!app) return null;
  const appName = APP_NAME[slug] ?? slug;

  const h = encodeURIComponent(handle);

  // Wavelength / Trubel / MyLoo / Kelva use influencer_handle directly on
  // every table. Yarn-Stash + Moto match on an UPPERCASE influencer_code in
  // referral_clicks (see Auto-Mint Handle-Bridge), but their handle still
  // populates the field too in the new pipeline.
  // 60s cache: shared across tabs + back-button navigation.
  const [convRows, paidRows, clickRows, refRows] = await Promise.all([
    sbGet(
      app,
      `referral_conversions?influencer_handle=eq.${h}&select=influencer_share_cents`,
      { revalidate: 60 },
    ),
    sbGet(
      app,
      `influencer_payout_items?influencer_handle=eq.${h}&status=eq.paid&select=amount_cents`,
      { revalidate: 60 },
    ),
    sbGet(
      app,
      `referral_clicks?influencer_handle=eq.${h}&select=id`,
      { revalidate: 60 },
    ),
    sbGet(
      app,
      `referrals?influencer_handle=eq.${h}&select=id,confirmed_at`,
      { revalidate: 60 },
    ),
  ]);

  const earnedCents = (convRows as Array<{ influencer_share_cents?: number }>).reduce(
    (s, r) => s + Number(r.influencer_share_cents ?? 0),
    0,
  );
  const paidCents = (paidRows as Array<{ amount_cents?: number }>).reduce(
    (s, r) => s + Number(r.amount_cents ?? 0),
    0,
  );
  const claimableCents = Math.max(0, earnedCents - paidCents);

  return {
    slug,
    appName,
    handle,
    matured_cents: earnedCents,
    paid_cents: paidCents,
    claimable_cents: claimableCents,
    clicks: clickRows.length,
    installs: refRows.length,
    conversions: convRows.length,
  };
}

function eur(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        email=""
        intro="Das Dashboard ist noch nicht voll konfiguriert (env NEXT_PUBLIC_KLAR_INBOX_ANON_KEY + KLAR_INBOX_SERVICE_KEY fehlt). Schreib uns kurz, wir aktivieren es."
      />
    );
  }

  const user = await getSessionUser();
  if (!user) redirect("/dashboard/login");

  // Existing legacy auth.users that sign in with a password never go through
  // the /auth/callback route, so their klar_affiliates row would never be
  // created. ensureAffiliate is idempotent: a no-op if the row already
  // exists, otherwise it walks the 6 app supabases by email and mints the
  // row from any matching influencer.contact_email.
  if (user.email) {
    await ensureAffiliate(user.id, user.email).catch((e) => {
      console.warn("[dashboard] ensure-affiliate threw", e);
    });
  }

  const affiliate = await loadAffiliate(user.id);
  if (!affiliate) {
    return (
      <EmptyState
        email={user.email ?? ""}
        intro="Wir konnten dein Affiliate-Profil noch nicht mit den Apps verknüpfen. Das kann ein paar Minuten dauern wenn du dich gerade frisch registriert hast. Oder du hast eine andere E-Mail benutzt als im Outreach."
      />
    );
  }

  const stats: AppStats[] = (
    await Promise.all(affiliate.apps.map((slug) => loadStatsForApp(slug, affiliate.handles[slug] ?? "")))
  ).filter((s): s is AppStats => s !== null);

  const totalClaimable = stats.reduce((s, x) => s + x.claimable_cents, 0);
  const totalMatured = stats.reduce((s, x) => s + x.matured_cents, 0);
  const totalPaid = stats.reduce((s, x) => s + x.paid_cents, 0);
  const totalClicks = stats.reduce((s, x) => s + x.clicks, 0);
  const totalInstalls = stats.reduce((s, x) => s + x.installs, 0);
  const totalConversions = stats.reduce((s, x) => s + x.conversions, 0);

  return (
    <div style={{ maxWidth: 940, margin: "0 auto", padding: "40px 24px 80px" }}>
      <header style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 6, fontFamily: "var(--font-mono, monospace)" }}>
            Klar · Affiliate
          </div>
          <h1 style={{ fontFamily: "var(--font-display, system-ui)", fontSize: "clamp(32px, 5vw, 44px)", fontWeight: 600, letterSpacing: -0.8, margin: 0, color: "var(--fg)" }}>
            Hi <i style={{ fontFamily: "var(--font-editorial, serif)" }}>{affiliate.display_name || user.email?.split("@")[0]}.</i>
          </h1>
          <p style={{ fontSize: 14.5, color: "var(--fg-2)", margin: "6px 0 0" }}>
            {affiliate.apps.length === 0
              ? "Du bist noch in keiner App eingetragen."
              : affiliate.apps.length === 1
              ? `Aktiv in ${APP_NAME[affiliate.apps[0]] ?? affiliate.apps[0]}.`
              : `Aktiv in ${affiliate.apps.length} Apps: ${affiliate.apps.map((s) => APP_NAME[s] ?? s).join(", ")}.`}
          </p>
        </div>
        <form action="/dashboard/logout" method="POST">
          <button
            type="submit"
            style={{
              padding: "8px 14px",
              background: "transparent",
              color: "var(--fg-2)",
              border: "1px solid color-mix(in oklab, var(--fg), transparent 80%)",
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Logout
          </button>
        </form>
      </header>

      {affiliate.status === "cancelled" && (
        <div style={{ padding: "14px 16px", background: "color-mix(in oklab, #f59e0b, transparent 86%)", border: "1px solid color-mix(in oklab, #f59e0b, transparent 70%)", borderRadius: 10, marginBottom: 24, fontSize: 14, color: "var(--fg)" }}>
          Dein Affiliate-Vertrag ist gekündigt seit{" "}
          {affiliate.cancelled_at ? new Date(affiliate.cancelled_at).toLocaleDateString("de-DE") : "-"}.
          Bereits verdiente Provisionen werden noch ausgezahlt. Bei Fragen <a href="mailto:alain@getklar.org" style={{ color: "var(--fg)" }}>alain@getklar.org</a>.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <Card eyebrow="① Earnings" title="Deine Provision">
          <Row label="Claimbar" value={eur(totalClaimable)} accent />
          <Row label="Reif (gesamt)" value={eur(totalMatured)} />
          <Row label="Bereits ausgezahlt" value={eur(totalPaid)} />
          {stats.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--fg-3)", letterSpacing: 0.4 }}>Pro App</summary>
              <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 6 }}>
                {stats.map((s) => (
                  <li key={s.slug} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--fg-2)" }}>
                    <span>{s.appName}</span>
                    <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{eur(s.claimable_cents)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>

        <Card eyebrow="② Funnel" title="Klicks → Käufe">
          <Row label="Klicks (alle Apps)" value={totalClicks.toLocaleString("de-DE")} />
          <Row label="Installs" value={totalInstalls.toLocaleString("de-DE")} />
          <Row label="Premium-Käufer" value={totalConversions.toLocaleString("de-DE")} accent />
          {totalInstalls > 0 && (
            <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 10 }}>
              Conversion-Rate: {((totalConversions / totalInstalls) * 100).toFixed(1)} %
            </div>
          )}
        </Card>

        <Card eyebrow="③ Rechtliches" title="Dein Vertrag">
          <p style={{ fontSize: 14, color: "var(--fg-2)", margin: "0 0 12px", lineHeight: 1.5 }}>
            Affiliate-Bedingungen v1.0, gültig seit 21. Mai 2026. 50 % Sub-Anteil, 24 Monate Attribution, 30 Tage Refund-Holdback.
          </p>
          <Link href="/legal/affiliate-agreement" style={pillLink}>Vertrag (DE) ansehen →</Link>
          <Link href="/legal/affiliate-agreement-en" style={{ ...pillLink, marginTop: 6 }}>Agreement (EN) ↗</Link>
        </Card>

        <Card eyebrow="④ Aktionen" title="Kontakt + Vertrag">
          <a href="https://cal.getklar.org/alain/affiliate-intro" target="_blank" rel="noopener noreferrer" style={primaryButton}>
            Termin mit Alain buchen
          </a>
          <a href="mailto:alain@getklar.org" style={secondaryButton}>
            alain@getklar.org schreiben
          </a>
          {affiliate.status !== "cancelled" && (
            <Link href="/dashboard/cancel" style={{ ...secondaryButton, color: "#f59e0b", borderColor: "color-mix(in oklab, #f59e0b, transparent 70%)" }}>
              Vertrag auflösen
            </Link>
          )}
        </Card>
      </div>

      <footer style={{ marginTop: 32, fontSize: 12, color: "var(--fg-4)", textAlign: "center" }}>
        Daten cached 60s. Letzte Aktualisierung: {new Date().toLocaleTimeString("de-DE")}.
      </footer>
    </div>
  );
}

function EmptyState({ email, intro }: { email: string; intro: string }) {
  return (
    <div style={{ maxWidth: 540, margin: "0 auto", padding: "80px 24px" }}>
      <h1 style={{ fontFamily: "var(--font-display, system-ui)", fontSize: 32, fontWeight: 600, letterSpacing: -0.6, margin: 0, color: "var(--fg)" }}>
        Hi <i style={{ fontFamily: "var(--font-editorial, serif)" }}>{email.split("@")[0]}.</i>
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.55, color: "var(--fg-2)", margin: "12px 0 24px" }}>
        {intro}
      </p>
      <a href="mailto:alain@getklar.org" style={primaryButton}>alain@getklar.org kontaktieren</a>
      <form action="/dashboard/logout" method="POST" style={{ marginTop: 18 }}>
        <button type="submit" style={{ ...secondaryButton, border: "none", background: "transparent", color: "var(--fg-3)" }}>
          Logout
        </button>
      </form>
    </div>
  );
}

function Card({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <article
      style={{
        background: "color-mix(in oklab, var(--fg), transparent 94%)",
        border: "1px solid color-mix(in oklab, var(--fg), transparent 82%)",
        borderRadius: 14,
        padding: "22px 22px 18px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ fontSize: 10.5, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 6, fontFamily: "var(--font-mono, monospace)" }}>
        {eyebrow}
      </div>
      <h2 style={{ fontFamily: "var(--font-display, system-ui)", fontSize: 18, fontWeight: 600, letterSpacing: -0.3, margin: "0 0 14px", color: "var(--fg)" }}>
        {title}
      </h2>
      {children}
    </article>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: "1px dashed color-mix(in oklab, var(--fg), transparent 86%)" }}>
      <span style={{ fontSize: 13, color: "var(--fg-2)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: accent ? 18 : 14, color: accent ? "var(--fg)" : "var(--fg-2)", fontWeight: accent ? 600 : 400 }}>
        {value}
      </span>
    </div>
  );
}

const primaryButton: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  padding: "11px 18px",
  background: "var(--fg)",
  color: "var(--bg)",
  borderRadius: 10,
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 14,
  marginBottom: 8,
};

const secondaryButton: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  padding: "10px 18px",
  background: "transparent",
  color: "var(--fg)",
  border: "1px solid color-mix(in oklab, var(--fg), transparent 70%)",
  borderRadius: 10,
  textDecoration: "none",
  fontWeight: 500,
  fontSize: 13.5,
  marginBottom: 8,
};

const pillLink: React.CSSProperties = {
  display: "block",
  padding: "8px 12px",
  background: "color-mix(in oklab, var(--fg), transparent 92%)",
  border: "1px solid color-mix(in oklab, var(--fg), transparent 80%)",
  borderRadius: 8,
  fontSize: 13,
  color: "var(--fg)",
  textDecoration: "none",
  fontWeight: 500,
};
