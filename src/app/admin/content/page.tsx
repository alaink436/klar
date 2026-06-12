// Klar Control · Content — Blotato posting-pipeline dashboard.
//
// Server component, same 2FA gate as the rest of /admin. Shows what goes out
// through Blotato: posts per connected channel, schedule/failure status and the
// recent post history. Data comes from lib/blotato.ts (key from the vault,
// provider "blotato"); no DB tables involved — Blotato's post list IS the state.
//
// Note: GET /v2/posts has no accountId field, so per-channel counts group by
// platform. With one account per platform (current setup) that is identical;
// if a second account on the same platform is ever connected, mirror posts into
// a klar table at publish time to keep exact per-account counts.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ICON, readCookieFromString, fmtRelative } from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getBlotatoOverview, type BlotatoAccount, type BlotatoPost } from "../../../lib/blotato";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------- ranges ----------

const RANGES = [
  { key: "7d", label: "7 Tage", days: 7 },
  { key: "30d", label: "30 Tage", days: 30 },
  { key: "90d", label: "90 Tage", days: 90 },
  { key: "all", label: "Gesamt", days: null },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

// ---------- platform meta ----------

const PLATFORM_META: Record<string, { label: string; icon: ReactNode }> = {
  tiktok: {
    label: "TikTok",
    icon: (
      // TikTok note mark, stroke-style to match the lucide set.
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-full">
        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
      </svg>
    ),
  },
  instagram: {
    label: "Instagram",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-full">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  youtube: {
    label: "YouTube",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-full">
        <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
        <path d="m10 15 5-3-5-3z" />
      </svg>
    ),
  },
};
function platformMeta(p: string): { label: string; icon: ReactNode } {
  return (
    PLATFORM_META[p] ?? {
      label: p.charAt(0).toUpperCase() + p.slice(1),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-full">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
    }
  );
}

// fmtRelative is past-only; scheduled posts sit in the future.
function fmtWhen(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const diff = d.getTime() - Date.now();
  if (diff > 0) {
    const days = Math.ceil(diff / 86_400_000);
    if (diff < 3_600_000) return `in ${Math.max(1, Math.round(diff / 60_000))}min`;
    if (diff < 86_400_000) return `in ${Math.round(diff / 3_600_000)}h`;
    return `in ${days}d`;
  }
  return fmtRelative(ts);
}

// ---------- presentational bits ----------

function Kpi({ k, v, s }: { k: string; v: ReactNode; s: ReactNode }) {
  return (
    <Card className="px-5 py-4">
      <div className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3">{k}</div>
      <div className="[font-family:var(--font-display)] font-extrabold text-[32px] leading-none tracking-[-0.03em] text-fg mt-2 [font-variant-numeric:tabular-nums]">{v}</div>
      <div className="text-[13px] text-fg-3 mt-2 font-medium">{s}</div>
    </Card>
  );
}

function SectionHead({ children }: { children: ReactNode }) {
  return (
    <div className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fg-3 mb-3 mt-8 flex items-center gap-2.5 after:content-[''] after:flex-1 after:h-px after:bg-line">
      {children}
    </div>
  );
}

function RangeChips({ active }: { active: RangeKey }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-6">
      {RANGES.map((r) => (
        <Link
          key={r.key}
          href={`/admin/content?range=${r.key}`}
          className={`[font-family:var(--font-mono)] text-[11px] px-3 py-1.5 rounded-full border transition-colors ${
            active === r.key
              ? "border-line-strong bg-surface-2 text-fg font-semibold"
              : "border-line text-fg-3 hover:text-fg hover:bg-surface-2"
          }`}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}

const STATE_BADGE: Record<BlotatoPost["state"]["type"], { tone: "ok" | "info" | "danger"; label: string }> = {
  published: { tone: "ok", label: "Published" },
  scheduled: { tone: "info", label: "Geplant" },
  failed: { tone: "danger", label: "Failed" },
};

function ChannelCard({
  account,
  inRange,
  total,
  lastPost,
  rangeLabel,
}: {
  account: BlotatoAccount;
  inRange: number;
  total: number;
  lastPost: string | null;
  rangeLabel: string;
}) {
  const meta = platformMeta(account.platform);
  return (
    <Card className="px-5 py-4 flex items-start gap-4">
      <div className="size-10 shrink-0 rounded-[var(--radius-sm)] border border-line bg-surface-2 text-fg-2 p-2.5">
        {meta.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-fg text-[14px] truncate">@{account.username || account.id}</span>
          <span className="[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.12em] text-fg-4">{meta.label}</span>
        </div>
        <div className="[font-family:var(--font-display)] font-extrabold text-[28px] leading-none tracking-[-0.03em] text-fg mt-2 [font-variant-numeric:tabular-nums]">
          {inRange}
        </div>
        <div className="text-[12px] text-fg-3 mt-1.5">
          Posts ({rangeLabel}) · {total} gesamt
          {lastPost ? <span className="text-fg-4"> · letzter {fmtRelative(lastPost)}</span> : null}
        </div>
      </div>
    </Card>
  );
}

// ---------- page ----------

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  // Auth — identical gate to outreach/brain/cal/bookings (device cookie + admin session).
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
  const range = RANGES.find((r) => r.key === sp.range) ?? RANGES[1]; // default 30d
  const sinceMs = range.days == null ? 0 : Date.now() - range.days * 86_400_000;

  const data = await getBlotatoOverview();

  const topbar = `
    <span class="crumb"><b>Content</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  // Aggregation: published is range-filtered, scheduled is inherently "future",
  // failed is range-filtered (a failure 3 months ago is not actionable today).
  const published = data.posts.filter((p) => p.state.type === "published");
  const publishedInRange = published.filter((p) => new Date(p.postTime).getTime() >= sinceMs);
  const scheduled = data.posts.filter((p) => p.state.type === "scheduled");
  const failedInRange = data.posts.filter(
    (p) => p.state.type === "failed" && new Date(p.postTime).getTime() >= sinceMs,
  );
  const nextScheduled = scheduled
    .filter((p) => new Date(p.postTime).getTime() > Date.now())
    .sort((a, b) => (a.postTime > b.postTime ? 1 : -1))[0];

  const perPlatform = (platform: string) => {
    const all = published.filter((p) => p.platform === platform);
    return {
      total: all.length,
      inRange: all.filter((p) => new Date(p.postTime).getTime() >= sinceMs).length,
      lastPost: all[0]?.postTime ?? null,
    };
  };

  const recentPosts = data.posts
    .filter((p) => p.state.type === "scheduled" || new Date(p.postTime).getTime() >= sinceMs)
    .slice(0, 30);

  return (
    <>
      <title>Content · Klar Control</title>
      <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
      <div className="content">
        <PageHeader eyebrow="Posting-Pipeline" title="Content">
          Was über Blotato rausgeht: Posts pro Kanal, Zeitplan und Status, direkt aus der Blotato-API.
        </PageHeader>

        {!data.ok ? (
          <Card className="px-6 py-5 border-danger/40">
            <div className="font-semibold text-fg text-[14px] mb-1.5">Blotato nicht erreichbar</div>
            <p className="text-[13px] text-fg-3 m-0 leading-relaxed">
              {data.reason === "no-key" ? (
                <>
                  Kein nutzbarer Blotato-Key gefunden. Der Key liegt im{" "}
                  <Link href="/admin/vault" className="font-semibold border-b border-line-strong hover:border-fg">Vault</Link>{" "}
                  (Provider <code>blotato</code>) und braucht <code>VAULT_MASTER_KEY</code> +{" "}
                  <code>KLAR_INBOX_SERVICE_KEY</code> in der Server-Env zum Entschlüsseln.
                </>
              ) : (
                <>Die Blotato-API hat nicht geantwortet ({data.reason}). Kurz warten und neu laden, Rate-Limit ist 30 req/min.</>
              )}
            </p>
          </Card>
        ) : (
          <>
            <RangeChips active={range.key} />

            <div className="grid gap-3 mb-7 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
              <Kpi
                k={`Published (${range.label})`}
                v={publishedInRange.length}
                s={`${published.length} gesamt${data.truncated ? " (letzte 2000)" : ""}`}
              />
              <Kpi
                k="Geplant"
                v={scheduled.length}
                s={nextScheduled ? `nächster ${fmtWhen(nextScheduled.postTime)}` : "nichts in der Queue"}
              />
              <Kpi k={`Failed (${range.label})`} v={failedInRange.length} s={failedInRange.length ? "Fehler unten in der Liste" : "keine Fehler"} />
              <Kpi
                k="Kanäle"
                v={data.accounts.length}
                s={data.accounts.length ? data.accounts.map((a) => platformMeta(a.platform).label).join(" · ") : "keine verbunden"}
              />
            </div>

            <SectionHead>Kanäle</SectionHead>
            {data.accounts.length === 0 ? (
              <Card className="px-6 py-5">
                <p className="text-[13px] text-fg-3 m-0">
                  Keine Social-Accounts mit Blotato verbunden. In der Blotato-App unter Accounts verbinden.
                </p>
              </Card>
            ) : (
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
                {data.accounts.map((a) => {
                  const agg = perPlatform(a.platform);
                  return (
                    <ChannelCard
                      key={a.id}
                      account={a}
                      inRange={agg.inRange}
                      total={agg.total}
                      lastPost={agg.lastPost}
                      rangeLabel={range.label}
                    />
                  );
                })}
              </div>
            )}

            <SectionHead>Posts ({range.label} + geplant)</SectionHead>
            {recentPosts.length === 0 ? (
              <Card className="px-6 py-6">
                <div className="font-semibold text-fg text-[14px] mb-1.5">Noch keine Posts über Blotato</div>
                <p className="text-[13px] text-fg-3 m-0 leading-relaxed">
                  Sobald die Posting-Pipeline den ersten Post über die API rausschickt, erscheinen hier
                  Status und Counts pro Kanal. Publizieren läuft über <code>POST /v2/posts</code> mit dem
                  Vault-Key, Referenz liegt im AI-Brain (<code>Infrastructure/blotato-api.md</code>).
                </p>
              </Card>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Wann</TableHead>
                    <TableHead>Kanal</TableHead>
                    <TableHead>Text</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPosts.map((p) => {
                    const badge = STATE_BADGE[p.state.type];
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap text-fg-3 text-[11px]" title={p.postTime}>
                          {fmtWhen(p.postTime)}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="size-3.5 text-fg-3">{platformMeta(p.platform).icon}</span>
                            <span className="[font-family:var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-fg-2">
                              {platformMeta(p.platform).label}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[420px]">
                          <span className="block truncate text-[12.5px] text-fg-2" title={p.text}>
                            {p.text || <span className="text-fg-4 italic">ohne Text</span>}
                          </span>
                          {p.state.type === "failed" && p.state.errorMessage ? (
                            <span className="block truncate text-[11px] text-danger mt-0.5" title={p.state.errorMessage}>
                              {p.state.errorMessage}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge tone={badge.tone}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {p.state.postUrl ? (
                            <a
                              href={p.state.postUrl}
                              target="_blank"
                              rel="noopener"
                              className="text-[12px] font-semibold text-fg-2 border-b border-line-strong hover:border-fg hover:text-fg"
                            >
                              öffnen ↗
                            </a>
                          ) : (
                            <span className="text-fg-4 text-[12px]">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </div>
    </>
  );
}
