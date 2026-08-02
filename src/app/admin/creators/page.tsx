// Klar Control · Creators — die Creator-Engine (Marketing #3).
//
// Server component. Liest klar_creators + klar_creator_posts (Migration 0014)
// aus dem Klar-Hub-Supabase und zeigt: Funnel (beworben → aktiv → postet),
// KPI-Zeile, Aufschlüsselung nach beworbener App und nach Recruiting-Kanal,
// dazu die Creator-Tabelle mit Status-Aktionen.
//
// Die Kanal-Aufschlüsselung ist der Kern: mehrere Recruiting-Kanäle zu fahren
// ergibt nur Sinn, wenn man sieht, welcher davon tatsächlich Creator liefert.
//
// Gleiche Chrome + 2FA-Gate wie der Rest von /admin. Fail-soft: solange
// Migration 0014 nicht angewendet ist, liefert der Store leere Listen und die
// Seite zeigt einen Setup-Hinweis statt zu crashen.
//
// Konzept + Phasen: AI-Brain `Projects/Marketing-3-Creator-Engine/PRD.md`.
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET, KLAR_INBOX_SERVICE_KEY.

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ICON, readCookieFromString, esc, fmtRelative } from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { KLAR_APPS } from "../../../lib/klarApps";
import { getCreatorOverview, isCreatorEngineConfigured } from "../../../lib/creatorStore";
import { EMPTY_CREATOR_FUNNEL, type CreatorBucket } from "../../../lib/creatorTypes";
import { Card } from "@/components/ui/card";
import CreatorFunnelCard from "./CreatorFunnelCard";
import CreatorTable, { type CreatorRow } from "./CreatorTable";
import CreatorAddForm from "./CreatorAddForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const appLabel = (slug: string): string =>
  KLAR_APPS.find((a) => a.slug === slug)?.name ?? slug;

function Kpi({ k, v, s }: { k: string; v: ReactNode; s: string }) {
  return (
    <Card className="px-5 py-4">
      <div className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3">{k}</div>
      <div className="[font-family:var(--font-display)] font-extrabold text-[32px] leading-none tracking-[-0.03em] text-fg mt-2 [font-variant-numeric:tabular-nums]">{v}</div>
      <div className="text-[13px] text-fg-3 mt-2 font-medium">{s}</div>
    </Card>
  );
}

/** Ranking-Karte mit Relativ-Balken — für App- und Kanal-Aufschlüsselung. */
function BucketCard({
  title,
  hint,
  buckets,
  empty,
}: {
  title: string;
  hint: string;
  buckets: CreatorBucket[];
  empty: string;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.total));
  return (
    <div className="card" style={{ padding: "20px 22px", display: "block" }}>
      <div className="k" style={{ marginBottom: 4 }}>{title}</div>
      <div className="muted" style={{ fontSize: 11.5, marginBottom: 14 }}>{hint}</div>
      {buckets.length === 0 ? (
        <span className="muted" style={{ fontSize: 13 }}>{empty}</span>
      ) : (
        buckets.map((b) => (
          <div key={b.key} style={{ display: "flex", alignItems: "center", gap: 11, margin: "9px 0" }}>
            <span style={{ minWidth: 132, fontSize: 12.5, color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {b.label}
            </span>
            <div style={{ flex: 1, background: "var(--surface-2)", height: 10, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, (b.total / max) * 100).toFixed(1)}%`, height: "100%", background: "var(--fg)" }} />
            </div>
            <span
              className="muted"
              style={{ minWidth: 92, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11.5, whiteSpace: "nowrap" }}
            >
              {b.total} · {b.posting} postet
            </span>
          </div>
        ))
      )}
    </div>
  );
}

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  // Auth — identisches Gate wie overview/outreach/bookings.
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) redirect("/admin/login");
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const device = await verifyDeviceCookie(readCookieFromString(cookieHeader, "klar_device"), DEV);
  if (!device) redirect("/admin/login");
  if (readCookieFromString(cookieHeader, "klar_admin") !== KEY) redirect("/admin/login");

  const sp = await searchParams;
  const configured = isCreatorEngineConfigured();
  const { funnel, byApp, bySource, creators, recentPosts } = configured
    ? await getCreatorOverview(appLabel)
    : {
        funnel: EMPTY_CREATOR_FUNNEL,
        byApp: [] as CreatorBucket[],
        bySource: [] as CreatorBucket[],
        creators: [],
        recentPosts: [],
      };

  // Posts pro Creator für die Tabelle — aus derselben Abfrage, kein zweiter
  // Roundtrip. recentPosts deckt nur 7d ab, deshalb zählen wir hier über die
  // Buckets hinweg nicht mit; die Spalte zeigt bewusst die 7d-Aktivität.
  const postCountByCreator = new Map<string, number>();
  for (const p of recentPosts) {
    if (!p.creator_id) continue;
    postCountByCreator.set(p.creator_id, (postCountByCreator.get(p.creator_id) ?? 0) + 1);
  }

  const rows: CreatorRow[] = creators.map((c) => ({
    ...c,
    appLabel: appLabel(c.app),
    postCount: postCountByCreator.get(c.id) ?? 0,
  }));

  const topbar = `
    <span class="crumb"><b>Creators</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;
  const flash = sp.msg ? `<div class="flash">${esc(sp.msg)}</div>` : "";

  return (
    <>
      <title>Creators · Klar Control</title>
      <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
      <div className="content">
        <div dangerouslySetInnerHTML={{ __html: flash }} />
        <h1>Creators</h1>
        <p className="sub">
          Leute, die vorbereitete Posts für eine App ihrer Wahl auf ihrem eigenen Kanal
          veröffentlichen. Vergütung läuft über die bestehende Affiliate-Mechanik
          (50% / 24 Monate).
        </p>

        {!configured ? (
          <div className="card" style={{ padding: "20px 22px", display: "block", marginTop: 16 }}>
            <div className="k">Nicht konfiguriert</div>
            <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              <code>KLAR_INBOX_SERVICE_KEY</code> fehlt — ohne den Service-Key kann diese Seite
              die Creator-Tabellen im Klar-Hub-Supabase nicht lesen.
            </p>
          </div>
        ) : (
          <>
            <div className="cards">
              <Kpi k="Beworben" v={funnel.applied} s={`${funnel.blocked} gesperrt`} />
              <Kpi k="Aktiv" v={funnel.active} s={`${funnel.paused} pausiert`} />
              <Kpi
                k="Postet"
                v={funnel.posting}
                s={funnel.activationRatePct != null ? `${funnel.activationRatePct}% der Aktiven` : "noch keine Aktiven"}
              />
              <Kpi
                k="Posts (7d)"
                v={funnel.posts7d}
                s={funnel.views7d > 0 ? `${funnel.views7d.toLocaleString("de-CH")} Views` : "noch keine Views erfasst"}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14, margin: "14px 0 22px" }}>
              <CreatorFunnelCard funnel={funnel} />
              <BucketCard
                title="Recruiting-Kanäle"
                hint="Welcher Kanal liefert tatsächlich Creator?"
                buckets={bySource}
                empty={"Noch keine Herkunft erfasst. Beim Anlegen das Feld „Herkunft“ setzen, sonst lässt sich später nicht sagen, welcher Kanal wirkt."}
              />
              <BucketCard
                title="Beworbene Apps"
                hint="Welche App wählen die Creator?"
                buckets={byApp}
                empty="Noch keine Creator."
              />
            </div>

            <CreatorAddForm apps={KLAR_APPS.map((a) => ({ slug: a.slug, name: a.name }))} />

            <h2>Alle Creator</h2>
            <CreatorTable rows={rows} />

            {recentPosts.length > 0 ? (
              <>
                <h2 style={{ marginTop: 28 }}>Letzte Posts</h2>
                <div className="card" style={{ padding: "8px 22px 12px", display: "block" }}>
                  {recentPosts.map((p) => (
                    <a
                      key={p.id}
                      href={p.external_url ?? "#"}
                      target={p.external_url ? "_blank" : undefined}
                      rel="noopener"
                      style={{
                        display: "flex", alignItems: "center", gap: 12, height: 46,
                        textDecoration: "none", borderTop: "1px solid var(--line)",
                      }}
                    >
                      <span style={{ minWidth: 90, fontSize: 12.5, color: "var(--fg-2)" }}>{appLabel(p.app)}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.caption || p.external_url || "(ohne Caption)"}
                      </span>
                      <span className="muted" style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                        {p.views != null ? `${p.views.toLocaleString("de-CH")} Views · ` : ""}
                        {fmtRelative(p.posted_at)}
                      </span>
                    </a>
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
