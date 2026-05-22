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
import { KlarWordmark } from "./_shared/auth-shell";

export const dynamic = "force-dynamic";

const APP_NAME: Record<string, string> = {
  wavelength: "Wavelength",
  kelva: "Kelva",
  trubel: "Trubel",
  myloo: "MyLoo",
  "yarn-stash": "Yarn-Stash",
  moto: "ThrottleUp",
};

// Public icon path per app-slug. Mirrors /icons/ in klar/public — same
// assets the affiliate-onboarding shell uses, so brand identity stays
// consistent between onboarding and dashboard.
const APP_ICON: Record<string, string> = {
  wavelength: "/icons/wavelength.webp",
  kelva: "/icons/kelva.webp",
  trubel: "/icons/trubel.webp",
  myloo: "/icons/myloo.webp",
  "yarn-stash": "/icons/yarnstash.webp",
  moto: "/icons/moto.webp",
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
  iconUrl: string;
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
  const iconUrl = APP_ICON[slug] ?? "/icons/yarnstash.webp";

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
    iconUrl,
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
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        firstName=""
        intro="The dashboard isn't fully configured yet (missing NEXT_PUBLIC_KLAR_INBOX_ANON_KEY + KLAR_INBOX_SERVICE_KEY env vars). Drop us a line and we'll switch it on."
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
  const firstName = (affiliate?.display_name || user.email?.split("@")[0] || "there").split(/\s+/)[0];

  if (!affiliate) {
    return (
      <EmptyState
        firstName={firstName}
        intro="We couldn't link your account to any of the apps yet. If you just signed up, give it a minute and refresh. If you used a different email in the outreach, drop us a note so we can connect the dots."
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
    <div style={{ maxWidth: 940, margin: "0 auto", padding: "32px 24px 80px" }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <KlarWordmark />
        <form action="/dashboard/logout" method="POST">
          <button
            type="submit"
            style={{
              padding: "7px 14px",
              background: "transparent",
              color: "var(--fg-2)",
              border: "1px solid color-mix(in oklab, var(--fg), transparent 80%)",
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Sign out
          </button>
        </form>
      </nav>

      <header style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 6, fontFamily: "var(--font-mono, monospace)" }}>
          Affiliate Dashboard
        </div>
        <h1 style={{ fontFamily: "var(--font-display, system-ui)", fontSize: "clamp(32px, 5vw, 44px)", fontWeight: 600, letterSpacing: -0.8, margin: 0, color: "var(--fg)" }}>
          Hi <i style={{ fontFamily: "var(--font-editorial, serif)" }}>{firstName}.</i>
        </h1>
        <div style={{ marginTop: 10 }}>
          <AppBadges apps={affiliate.apps} handles={affiliate.handles} />
        </div>
      </header>

      {affiliate.status === "cancelled" && (
        <div style={{ padding: "14px 16px", background: "color-mix(in oklab, #f59e0b, transparent 86%)", border: "1px solid color-mix(in oklab, #f59e0b, transparent 70%)", borderRadius: 10, marginBottom: 24, fontSize: 14, color: "var(--fg)" }}>
          Your affiliate contract was cancelled on{" "}
          {affiliate.cancelled_at ? new Date(affiliate.cancelled_at).toLocaleDateString("en-IE") : "-"}.
          Already-earned commissions will still be paid out. Questions? <a href="mailto:alain@getklar.org" style={{ color: "var(--fg)" }}>alain@getklar.org</a>.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <Card eyebrow="① Earnings" title="Your commission">
          <Row label="Available to claim" value={eur(totalClaimable)} accent />
          <Row label="Total earned" value={eur(totalMatured)} />
          <Row label="Already paid out" value={eur(totalPaid)} />
          {stats.length > 1 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--fg-3)", letterSpacing: 0.4 }}>Per app</summary>
              <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 8 }}>
                {stats.map((s) => (
                  <li key={s.slug} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--fg-2)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.iconUrl} alt="" width={20} height={20} style={{ borderRadius: 5 }} />
                    <span style={{ flex: 1 }}>{s.appName}</span>
                    <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{eur(s.claimable_cents)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>

        <Card eyebrow="② Funnel" title="Clicks to buyers">
          <Row label="Clicks" value={totalClicks.toLocaleString("en-IE")} />
          <Row label="Installs" value={totalInstalls.toLocaleString("en-IE")} />
          <Row label="Premium buyers" value={totalConversions.toLocaleString("en-IE")} accent />
          {totalInstalls > 0 && (
            <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 10 }}>
              Install → buyer conversion: {((totalConversions / totalInstalls) * 100).toFixed(1)} %
            </div>
          )}
          {totalClicks > 0 && totalInstalls > 0 && (
            <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 4 }}>
              Click → install conversion: {((totalInstalls / totalClicks) * 100).toFixed(1)} %
            </div>
          )}
        </Card>

        <Card eyebrow="③ Legal" title="Your contract">
          <p style={{ fontSize: 14, color: "var(--fg-2)", margin: "0 0 12px", lineHeight: 1.5 }}>
            Affiliate terms v1.0, effective 21 May 2026. App-specific commission rate, 12-24 month attribution window, 30-day refund hold-back.
          </p>
          <Link href="/legal/affiliate-agreement-en" style={pillLink}>Read agreement (EN) →</Link>
          <Link href="/legal/affiliate-agreement" style={{ ...pillLink, marginTop: 6 }}>Lesen auf Deutsch ↗</Link>
        </Card>

        <Card eyebrow="④ Actions" title="Contact + contract">
          <a href="https://cal.getklar.org/alain/affiliate-intro" target="_blank" rel="noopener noreferrer" style={primaryButton}>
            Book a call with Alain
          </a>
          <a href="mailto:alain@getklar.org" style={secondaryButton}>
            Email alain@getklar.org
          </a>
          {affiliate.status !== "cancelled" && (
            <Link href="/dashboard/cancel" style={{ ...secondaryButton, color: "#f59e0b", borderColor: "color-mix(in oklab, #f59e0b, transparent 70%)" }}>
              Cancel contract
            </Link>
          )}
        </Card>
      </div>

      <footer style={{ marginTop: 32, fontSize: 12, color: "var(--fg-4)", textAlign: "center" }}>
        Data cached for 60 seconds. Last refreshed: {new Date().toLocaleTimeString("en-IE")}.
      </footer>
    </div>
  );
}

// Pill row of app icons + handle, sits below the "Hi Name." headline.
// One pill per app the affiliate is wired into. Click goes nowhere yet —
// later we'll let users drill down into a per-app breakdown.
function AppBadges({ apps, handles }: { apps: string[]; handles: Record<string, string> }) {
  if (apps.length === 0) {
    return (
      <span style={{ fontSize: 14, color: "var(--fg-3)" }}>
        Not connected to any app yet.
      </span>
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <span style={{ fontSize: 14, color: "var(--fg-2)", marginRight: 4 }}>
        Affiliate for
      </span>
      {apps.map((slug) => {
        const name = APP_NAME[slug] ?? slug;
        const icon = APP_ICON[slug];
        const handle = handles[slug];
        return (
          <span
            key={slug}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 10px 5px 5px",
              background: "color-mix(in oklab, var(--fg), transparent 92%)",
              border: "1px solid color-mix(in oklab, var(--fg), transparent 80%)",
              borderRadius: 999,
              fontSize: 13,
              color: "var(--fg)",
            }}
          >
            {icon && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={icon} alt="" width={22} height={22} style={{ borderRadius: 6 }} />
            )}
            <b style={{ fontWeight: 600 }}>{name}</b>
            {handle && <span style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>@{handle}</span>}
          </span>
        );
      })}
    </div>
  );
}

function EmptyState({ firstName, intro }: { firstName: string; intro: string }) {
  return (
    <div style={{ maxWidth: 540, margin: "0 auto", padding: "80px 24px" }}>
      <div style={{ marginBottom: 24 }}>
        <KlarWordmark />
      </div>
      <h1 style={{ fontFamily: "var(--font-display, system-ui)", fontSize: 32, fontWeight: 600, letterSpacing: -0.6, margin: 0, color: "var(--fg)" }}>
        Hi <i style={{ fontFamily: "var(--font-editorial, serif)" }}>{firstName || "there"}.</i>
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.55, color: "var(--fg-2)", margin: "12px 0 24px" }}>
        {intro}
      </p>
      <a href="mailto:alain@getklar.org" style={primaryButton}>Email alain@getklar.org</a>
      <form action="/dashboard/logout" method="POST" style={{ marginTop: 18 }}>
        <button type="submit" style={{ ...secondaryButton, border: "none", background: "transparent", color: "var(--fg-3)" }}>
          Sign out
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
      <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: accent ? 20 : 14, color: accent ? "var(--fg)" : "var(--fg-2)", fontWeight: accent ? 600 : 400 }}>
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
