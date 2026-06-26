// Klar Control · Content — Blotato posting-pipeline dashboard.
//
// Server component, same 2FA gate as the rest of /admin. Shows what goes out
// through Blotato: posts + views per connected channel, a published-over-time
// chart, top posts by views and the post history. Data comes from
// lib/blotato.ts (key from the vault, provider "blotato"); views/likes come
// from GET /v2/analytics (lifetime metrics of posts created in the range).
//
// Note: GET /v2/posts has no accountId field, so per-channel numbers group by
// platform. With one account per platform (current setup) that is identical;
// if a second account on the same platform is ever connected, mirror posts into
// a klar table at publish time to keep exact per-account counts.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ICON, readCookieFromString, fmtRelative } from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import {
  getBlotatoOverview,
  type BlotatoAccount,
  type BlotatoAnalyticsItem,
  type BlotatoPost,
} from "../../../lib/blotato";
import { getNativeCounts, type NativeCount } from "../../../lib/contentWarmup";
import { KLAR_APPS } from "../../../lib/klarApps";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ContentChart, { type ContentChartRow } from "./ContentChart";
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

// ---------- app attribution ----------
// Blotato posts carry no app field, so posts are attributed by app mentions in
// the post text (names, slugs, store aliases — hashtags match too since they
// contain the name). Unmatched posts land in the "Studio" bucket. Once the
// posting pipeline writes its own posted_content table, swap this heuristic
// for the explicit app column.

const APP_EXTRA_ALIASES: Record<string, string[]> = {
  "yarn-stash": ["yarn stash", "yarnstash"],
  moto: ["throttleup", "throttle up"],
  promillio: ["promillo"],
  wavelength: ["thinq"],
  myloo: ["my loo"],
};

interface AppBucketMeta {
  slug: string;
  label: string;
  icon: string;
}

const STUDIO_BUCKET: AppBucketMeta = { slug: "studio", label: "Studio", icon: "/logo/klar-symbol.png" };
const APP_BUCKETS: AppBucketMeta[] = [
  ...KLAR_APPS.map((a) => ({ slug: a.slug, label: a.name, icon: a.icon })),
  STUDIO_BUCKET,
];
const bucketMeta = (slug: string): AppBucketMeta =>
  APP_BUCKETS.find((b) => b.slug === slug) ?? STUDIO_BUCKET;

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const APP_MATCHERS = KLAR_APPS.map((a) => {
  const aliases = [...new Set([a.slug, a.name.toLowerCase(), ...(APP_EXTRA_ALIASES[a.slug] ?? [])])];
  return { slug: a.slug, re: new RegExp(`\\b(${aliases.map(escRe).join("|")})\\b`, "i") };
});
function detectApp(text: string): string {
  for (const m of APP_MATCHERS) if (m.re.test(text)) return m.slug;
  return "studio";
}

// ---------- formatting ----------

// fmtRelative is past-only; scheduled posts sit in the future.
function fmtWhen(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const diff = d.getTime() - Date.now();
  if (diff > 0) {
    if (diff < 3_600_000) return `in ${Math.max(1, Math.round(diff / 60_000))}min`;
    if (diff < 86_400_000) return `in ${Math.round(diff / 3_600_000)}h`;
    return `in ${Math.ceil(diff / 86_400_000)}d`;
  }
  return fmtRelative(ts);
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(n);
}

// ---------- presentational bits ----------

function Kpi({ k, v, s }: { k: string; v: ReactNode; s: ReactNode }) {
  return (
    <Card className="px-5 py-4">
      <div className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3">{k}</div>
      <div className="[font-family:var(--font-display)] font-extrabold text-[32px] leading-none tracking-[-0.03em] text-fg mt-2 [font-variant-numeric:tabular-nums]">{v}</div>
      <div className="text-[12.5px] text-fg-3 mt-2 font-medium truncate">{s}</div>
    </Card>
  );
}

function SectionHead({ children }: { children: ReactNode }) {
  return (
    <div className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fg-3 mb-3 mt-9 flex items-center gap-2.5 after:content-[''] after:flex-1 after:h-px after:bg-line">
      {children}
    </div>
  );
}

function RangeSegment({ active, hideParam }: { active: RangeKey; hideParam: string }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-1 shadow-[var(--shadow-sm)]">
      {RANGES.map((r) => (
        <Link
          key={r.key}
          href={`/admin/content?range=${r.key}${hideParam ? `&hide=${hideParam}` : ""}`}
          className={`[font-family:var(--font-mono)] text-[10.5px] uppercase tracking-[0.06em] px-3 py-1.5 rounded-full border transition-colors ${
            active === r.key
              ? "border-line-strong bg-surface-2 text-fg font-semibold"
              : "border-transparent text-fg-3 hover:text-fg"
          }`}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="[font-family:var(--font-mono)] text-[9px] uppercase tracking-[0.12em] text-fg-4">{label}</div>
      <div className="[font-family:var(--font-display)] font-extrabold text-[22px] leading-none tracking-[-0.02em] text-fg mt-1.5 [font-variant-numeric:tabular-nums]">
        {value}
      </div>
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="w-14 text-right">
      <div className="text-[13px] font-semibold text-fg [font-variant-numeric:tabular-nums]">{value}</div>
      <div className="[font-family:var(--font-mono)] text-[8.5px] uppercase tracking-[0.1em] text-fg-4 mt-0.5">{label}</div>
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
  posts,
  views,
  likes,
  lastPost,
  native,
}: {
  account: BlotatoAccount;
  posts: number;
  views: number;
  likes: number;
  lastPost: string | null;
  native?: NativeCount;
}) {
  const meta = platformMeta(account.platform);
  // The native profile count is the real lifetime total (manual + pipeline posts).
  // Blotato `posts` only sees pipeline posts in the range, so a warm account that
  // is still posted to manually reads 0 there — prefer the profile count, fall
  // back to the Blotato number only when the scrape was not readable.
  const profilePosts = native?.posts ?? null;
  const followers = native?.followers ?? null;
  return (
    <Card className="px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="size-9 shrink-0 rounded-[var(--radius-sm)] border border-line bg-surface-2 text-fg-2 p-2">{meta.icon}</div>
        <div className="min-w-0">
          <div className="font-semibold text-fg text-[14px] leading-tight truncate">@{account.username || account.id}</div>
          <div className="[font-family:var(--font-mono)] text-[9px] uppercase tracking-[0.14em] text-fg-4 mt-0.5">{meta.label}</div>
        </div>
        <span className="ml-auto text-[11px] text-fg-4 whitespace-nowrap">
          {followers !== null
            ? `${fmtCompact(followers)} Follower`
            : lastPost
              ? `letzter ${fmtRelative(lastPost)}`
              : "noch kein Post"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4 pt-3.5 border-t border-line">
        <Stat label={profilePosts !== null ? "Posts (Profil)" : "Posts"} value={profilePosts ?? posts} />
        <Stat label="Views" value={fmtCompact(views)} />
        <Stat label="Likes" value={fmtCompact(likes)} />
      </div>
    </Card>
  );
}

// ---------- warm / cold accounts ----------
// Which accounts are already "warm" (organic activity, safe for the Blotato
// auto-pipeline) vs still "cold" (must be warmed by posting manually first, so
// the platform does not bot-flag them). SoT for this list lives in the AI-Brain
// (Projects/Inbound-Strategy/PROGRESS.md) — keep it in sync. Anything NOT listed
// here is treated as cold: a freshly connected account always needs warming.
const WARM_USERNAMES = new Set(["clairmentklarclear", "kelvaapp"]);
const isWarmAccount = (a: BlotatoAccount): boolean => WARM_USERNAMES.has((a.username || "").toLowerCase());

function ChannelSubhead({ children }: { children: ReactNode }) {
  return (
    <div className="[font-family:var(--font-mono)] text-[9px] font-semibold uppercase tracking-[0.14em] text-fg-4 px-1 pt-1 first:pt-0">
      {children}
    </div>
  );
}

// Cold accounts read their post count straight off the public profile (Evomi),
// since Blotato never sees a manually posted warm-up post.
function ColdChannelCard({ account, native }: { account: BlotatoAccount; native?: NativeCount }) {
  const meta = platformMeta(account.platform);
  const posts = native?.posts ?? null;
  const followers = native?.followers ?? null;
  return (
    <Card className="px-5 py-4 border-amber-500/30">
      <div className="flex items-center gap-3">
        <div className="size-9 shrink-0 rounded-[var(--radius-sm)] border border-line bg-surface-2 text-fg-2 p-2">{meta.icon}</div>
        <div className="min-w-0">
          <div className="font-semibold text-fg text-[14px] leading-tight truncate">@{account.username || account.id}</div>
          <div className="[font-family:var(--font-mono)] text-[9px] uppercase tracking-[0.14em] text-fg-4 mt-0.5">{meta.label}</div>
        </div>
        <span className="ml-auto [font-family:var(--font-mono)] text-[9px] uppercase tracking-[0.1em] text-amber-600 dark:text-amber-400 border border-amber-500/40 rounded-full px-2 py-0.5">
          Kalt
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4 pt-3.5 border-t border-line">
        <Stat label="Posts (Profil)" value={posts === null ? "—" : posts} />
        <Stat label="Follower" value={followers === null ? "—" : fmtCompact(followers)} />
      </div>
      <p className="text-[11px] text-fg-4 mt-3 leading-relaxed m-0">
        {posts === null
          ? "Profil gerade nicht lesbar — Postzahl lädt beim nächsten Aufruf."
          : "Native Postzahl vom Profil. Manuell weiter aufwärmen, dann auf Auto-Pipeline."}
      </p>
    </Card>
  );
}

// ---------- chart bucketing ----------

function buildChart(
  published: BlotatoPost[],
  rangeKey: RangeKey,
  sinceMs: number,
): { rows: ContentChartRow[]; categories: string[]; unitLabel: string } {
  const now = Date.now();
  const DAY = 86_400_000;
  let buckets: { start: number; end: number; label: string }[] = [];
  let unitLabel: string;
  const dayLabel = (t: number) => {
    const d = new Date(t);
    return `${d.getDate()}.${d.getMonth() + 1}.`;
  };
  if (rangeKey === "7d") {
    unitLabel = "Tag";
    for (let i = 6; i >= 0; i--) {
      const start = now - i * DAY;
      buckets.push({ start: start - DAY, end: start, label: dayLabel(start) });
    }
  } else if (rangeKey === "all") {
    unitLabel = "Monat";
    const first = published.length ? new Date(published[published.length - 1].postTime) : new Date(now);
    const cur = new Date(first.getFullYear(), first.getMonth(), 1);
    const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    while (cur.getTime() <= now) {
      const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      buckets.push({ start: cur.getTime(), end: next.getTime(), label: `${MONTHS[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}` });
      cur.setMonth(cur.getMonth() + 1);
    }
    buckets = buckets.slice(-12); // newest 12 months
  } else {
    unitLabel = "Woche";
    const weeks = rangeKey === "30d" ? 5 : 13;
    for (let i = weeks - 1; i >= 0; i--) {
      const end = now - i * 7 * DAY;
      buckets.push({ start: end - 7 * DAY, end, label: dayLabel(end - 7 * DAY) });
    }
  }

  const inRange = published.filter((p) => new Date(p.postTime).getTime() >= sinceMs);
  const platforms = [...new Set(inRange.map((p) => platformMeta(p.platform).label))];
  const totals = new Map<string, number>(platforms.map((pl) => [pl, 0]));
  const rows: ContentChartRow[] = buckets.map((b) => {
    const row: ContentChartRow = { label: b.label };
    for (const pl of platforms) row[pl] = 0;
    for (const p of inRange) {
      const t = new Date(p.postTime).getTime();
      if (t >= b.start && t < b.end) {
        const pl = platformMeta(p.platform).label;
        row[pl] = (row[pl] as number) + 1;
        totals.set(pl, (totals.get(pl) ?? 0) + 1);
      }
    }
    return row;
  });
  // 3 chart tokens available — order by volume, fold the tail into "Andere".
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([pl]) => pl);
  let categories = ranked;
  if (ranked.length > 3) {
    categories = [...ranked.slice(0, 2), "Andere"];
    for (const row of rows) {
      let rest = 0;
      for (const pl of ranked.slice(2)) {
        rest += (row[pl] as number) ?? 0;
        delete row[pl];
      }
      row["Andere"] = rest;
    }
  }
  return { rows, categories, unitLabel };
}

// ---------- page ----------

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; hide?: string }>;
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

  const data = await getBlotatoOverview(range.days == null ? undefined : new Date(sinceMs).toISOString());

  // Warm/cold split + native profile post counts. Blotato only knows posts IT
  // published, but warm accounts are still posted to MANUALLY, so their real post
  // count lives on the public profile too — not just for cold accounts. Read it
  // for every account off the profile (Evomi) — bounded + cached in
  // lib/contentWarmup.
  const warmAccounts = data.accounts.filter(isWarmAccount);
  const coldAccounts = data.accounts.filter((a) => !isWarmAccount(a));
  const nativeCounts = await getNativeCounts(
    data.accounts.map((a) => ({ platform: a.platform, username: a.username })),
  );

  const topbar = `
    <span class="crumb"><b>Content</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  // App attribution + visibility: ?hide=slug,slug blendet App-Buckets aus.
  // Chip counts use the unfiltered sets so hidden apps stay toggleable.
  const hidden = new Set((sp.hide ?? "").split(",").filter((s) => APP_BUCKETS.some((b) => b.slug === s)));
  const appOfPost = new Map(data.posts.map((p) => [p.id, detectApp(p.text)]));
  const appOfItem = (a: BlotatoAnalyticsItem) => detectApp(a.content);
  const posts = data.posts.filter((p) => !hidden.has(appOfPost.get(p.id) ?? "studio"));
  const analyticsAllInRange = data.analytics.filter(
    (a) => !a.createdAt || new Date(a.createdAt).getTime() >= sinceMs,
  );

  // Aggregation: published is range-filtered, scheduled is inherently "future",
  // failed is range-filtered (a failure 3 months ago is not actionable today).
  const published = posts.filter((p) => p.state.type === "published");
  const publishedInRange = published.filter((p) => new Date(p.postTime).getTime() >= sinceMs);
  const scheduled = posts.filter((p) => p.state.type === "scheduled");
  const failedInRange = posts.filter(
    (p) => p.state.type === "failed" && new Date(p.postTime).getTime() >= sinceMs,
  );
  const nextScheduled = scheduled
    .filter((p) => new Date(p.postTime).getTime() > Date.now())
    .sort((a, b) => (a.postTime > b.postTime ? 1 : -1))[0];

  // Metrics (lifetime values of posts created in the range, from /v2/analytics).
  const analytics = analyticsAllInRange.filter((a) => !hidden.has(appOfItem(a)));

  // Per-app buckets (range window, pre-hide for the chips, sorted by views).
  interface BucketStats { meta: AppBucketMeta; posts: number; views: number; likes: number; engagement: number }
  const bucketMap = new Map<string, BucketStats>();
  const bucketFor = (slug: string): BucketStats => {
    let b = bucketMap.get(slug);
    if (!b) {
      b = { meta: bucketMeta(slug), posts: 0, views: 0, likes: 0, engagement: 0 };
      bucketMap.set(slug, b);
    }
    return b;
  };
  for (const p of data.posts) {
    if (p.state.type !== "published" || new Date(p.postTime).getTime() < sinceMs) continue;
    bucketFor(appOfPost.get(p.id) ?? "studio").posts++;
  }
  for (const a of analyticsAllInRange) {
    const b = bucketFor(appOfItem(a));
    b.views += a.metrics.views;
    b.likes += a.metrics.likes;
    b.engagement += a.metrics.likes + a.metrics.comments + a.metrics.shares;
  }
  const bucketStats = [...bucketMap.values()].sort((x, y) => y.views - x.views || y.posts - x.posts);
  const visibleBuckets = bucketStats.filter((b) => !hidden.has(b.meta.slug) && (b.posts > 0 || b.views > 0));
  const maxBucketViews = Math.max(1, ...visibleBuckets.map((b) => b.views));

  const toggleHref = (slug: string): string => {
    const h = new Set(hidden);
    if (h.has(slug)) h.delete(slug);
    else h.add(slug);
    const qs = new URLSearchParams({ range: range.key });
    if (h.size) qs.set("hide", [...h].join(","));
    return `/admin/content?${qs.toString()}`;
  };
  const sum = (f: (a: BlotatoAnalyticsItem) => number) => analytics.reduce((acc, a) => acc + f(a), 0);
  const viewsTotal = sum((a) => a.metrics.views);
  const likesTotal = sum((a) => a.metrics.likes);
  const commentsTotal = sum((a) => a.metrics.comments);
  const sharesTotal = sum((a) => a.metrics.shares);
  const engagementTotal = likesTotal + commentsTotal + sharesTotal;

  const byId = new Map(analytics.map((a) => [a.id, a]));
  const byUrl = new Map(analytics.filter((a) => a.postUrl).map((a) => [a.postUrl as string, a]));
  const metricsFor = (p: BlotatoPost): BlotatoAnalyticsItem | undefined =>
    byId.get(p.id) ?? (p.state.postUrl ? byUrl.get(p.state.postUrl) : undefined);

  const perPlatform = (platform: string) => {
    const all = published.filter((p) => p.platform === platform);
    const a = analytics.filter((x) => x.platform === platform);
    return {
      inRange: all.filter((p) => new Date(p.postTime).getTime() >= sinceMs).length,
      views: a.reduce((acc, x) => acc + x.metrics.views, 0),
      likes: a.reduce((acc, x) => acc + x.metrics.likes, 0),
      lastPost: all[0]?.postTime ?? null,
    };
  };

  const topPosts = analytics
    .filter((a) => a.metrics.views + a.metrics.likes + a.metrics.comments > 0)
    .sort((a, b) => b.metrics.views - a.metrics.views)
    .slice(0, 5);

  const chart = buildChart(published, range.key, sinceMs);
  const recentPosts = posts
    .filter((p) => p.state.type === "scheduled" || new Date(p.postTime).getTime() >= sinceMs)
    .slice(0, 30);

  const stand = new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich",
  }).format(new Date(data.fetched_at));

  const viewsSub =
    viewsTotal > 0
      ? [...new Set(analytics.map((a) => a.platform))]
          .map((pl) => ({ pl, v: analytics.filter((a) => a.platform === pl).reduce((acc, a) => acc + a.metrics.views, 0) }))
          .sort((a, b) => b.v - a.v)
          .slice(0, 2)
          .map(({ pl, v }) => `${platformMeta(pl).label} ${fmtCompact(v)}`)
          .join(" · ")
      : publishedInRange.length > 0
        ? "Blotato sammelt Metriken nach"
        : "kommt mit dem ersten Post";

  return (
    <>
      <title>Content · Klar Control</title>
      <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
      <div className="content">
        <PageHeader eyebrow="Posting-Pipeline" title="Content">
          Posts, Views und Zeitplan aller Blotato-Kanäle.
        </PageHeader>

        {!data.ok ? (
          <Card className="px-6 py-5">
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
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <RangeSegment active={range.key} hideParam={[...hidden].join(",")} />
              <span className="[font-family:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-fg-4">
                Stand {stand}
              </span>
            </div>

            {bucketStats.length > 0 ? (
              <div className="flex items-center flex-wrap gap-1.5 mb-6">
                <span className="[font-family:var(--font-mono)] text-[9.5px] font-semibold uppercase tracking-[0.14em] text-fg-4 mr-1">
                  Apps
                </span>
                {bucketStats.map((b) => {
                  const off = hidden.has(b.meta.slug);
                  return (
                    <Link
                      key={b.meta.slug}
                      href={toggleHref(b.meta.slug)}
                      title={off ? `${b.meta.label} einblenden` : `${b.meta.label} ausblenden`}
                      className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                        off
                          ? "border-line text-fg-4 opacity-50 hover:opacity-80"
                          : "border-line-strong bg-surface text-fg-2 hover:text-fg"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.meta.icon} alt="" width={14} height={14} className="size-3.5 rounded-[4px]" />
                      <span className={off ? "line-through" : "font-medium"}>{b.meta.label}</span>
                      <span className="[font-family:var(--font-mono)] text-[9px] text-fg-4 [font-variant-numeric:tabular-nums]">
                        {b.posts}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="mb-6" />
            )}

            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(165px,1fr))]">
              <Kpi k="Published" v={publishedInRange.length} s={`${published.length} gesamt${data.truncated ? " (letzte 2000)" : ""}`} />
              <Kpi k="Views" v={fmtCompact(viewsTotal)} s={viewsSub} />
              <Kpi
                k="Engagement"
                v={fmtCompact(engagementTotal)}
                s={
                  engagementTotal > 0
                    ? `${fmtCompact(likesTotal)} Likes · ${fmtCompact(commentsTotal)} Komm. · ${fmtCompact(sharesTotal)} Shares`
                    : "Likes, Kommentare und Shares"
                }
              />
              <Kpi k="Geplant" v={scheduled.length} s={nextScheduled ? `nächster ${fmtWhen(nextScheduled.postTime)}` : "nichts in der Queue"} />
            </div>

            {failedInRange.length > 0 ? (
              <div className="mt-3 px-4 py-3 rounded-[var(--radius-sm)] border border-red-500/25 bg-red-500/5 text-[12.5px] text-fg-2">
                <span className="font-semibold text-danger">
                  {failedInRange.length} {failedInRange.length === 1 ? "Post" : "Posts"} fehlgeschlagen
                </span>{" "}
                im Zeitraum, Details unten in der Historie.
              </div>
            ) : null}

            <SectionHead>Kanäle &amp; Verlauf</SectionHead>
            <div className="grid gap-3 lg:[grid-template-columns:minmax(300px,5fr)_7fr]">
              <div className="grid gap-3 content-start">
                {data.accounts.length === 0 ? (
                  <Card className="px-5 py-4">
                    <p className="text-[13px] text-fg-3 m-0">
                      Keine Social-Accounts mit Blotato verbunden. In der Blotato-App unter Accounts verbinden.
                    </p>
                  </Card>
                ) : (
                  <>
                    {warmAccounts.length > 0 ? (
                      <>
                        <ChannelSubhead>Warm · Auto-Pipeline</ChannelSubhead>
                        {warmAccounts.map((a) => {
                          const agg = perPlatform(a.platform);
                          return (
                            <ChannelCard
                              key={a.id}
                              account={a}
                              posts={agg.inRange}
                              views={agg.views}
                              likes={agg.likes}
                              lastPost={agg.lastPost}
                              native={nativeCounts.get((a.username || "").toLowerCase())}
                            />
                          );
                        })}
                      </>
                    ) : null}
                    {coldAccounts.length > 0 ? (
                      <>
                        <ChannelSubhead>Kalt · Warm-up (manuell posten)</ChannelSubhead>
                        {coldAccounts.map((a) => (
                          <ColdChannelCard
                            key={a.id}
                            account={a}
                            native={nativeCounts.get((a.username || "").toLowerCase())}
                          />
                        ))}
                      </>
                    ) : null}
                  </>
                )}
              </div>
              <Card className="px-5 py-4">
                <div className="flex items-baseline justify-between mb-4">
                  <span className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3">
                    Published pro {chart.unitLabel}
                  </span>
                  <span className="text-[11px] text-fg-4">{publishedInRange.length} Posts ({range.label})</span>
                </div>
                {publishedInRange.length > 0 ? (
                  <ContentChart data={chart.rows} categories={chart.categories} />
                ) : (
                  <div className="h-56 flex items-center justify-center text-[12.5px] text-fg-4 italic">
                    Noch keine veröffentlichten Posts im Zeitraum
                  </div>
                )}
              </Card>
            </div>

            {visibleBuckets.length > 0 ? (
              <>
                <SectionHead>Apps im Vergleich</SectionHead>
                <Card className="p-0 overflow-hidden">
                  {visibleBuckets.map((b, i) => (
                    <div key={b.meta.slug} className="flex items-center gap-4 px-5 py-3 border-t border-line first:border-t-0">
                      <span className="[font-family:var(--font-display)] font-extrabold text-[20px] leading-none text-fg-4 w-6 text-right shrink-0 [font-variant-numeric:tabular-nums]">
                        {i + 1}
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.meta.icon} alt="" width={28} height={28} className="size-7 shrink-0 rounded-[7px] border border-line" />
                      <div className="w-32 shrink-0 min-w-0">
                        <div className="font-semibold text-fg text-[13px] leading-tight truncate">{b.meta.label}</div>
                        <div className="[font-family:var(--font-mono)] text-[9px] uppercase tracking-[0.1em] text-fg-4 mt-0.5">
                          {b.posts} {b.posts === 1 ? "Post" : "Posts"}
                        </div>
                      </div>
                      <div className="flex-1 hidden md:block">
                        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--chart-1)]"
                            style={{ width: `${Math.max(2, Math.round((b.views / maxBucketViews) * 100))}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex gap-4 shrink-0 ml-auto">
                        <MiniStat value={fmtCompact(b.views)} label="Views" />
                        <MiniStat value={fmtCompact(b.posts > 0 ? Math.round(b.views / b.posts) : b.views)} label="Ø/Post" />
                        <MiniStat value={fmtCompact(b.likes)} label="Likes" />
                      </div>
                    </div>
                  ))}
                </Card>
              </>
            ) : null}

            {topPosts.length > 0 ? (
              <>
                <SectionHead>Top Posts</SectionHead>
                <Card className="p-0 overflow-hidden">
                  {topPosts.map((t, i) => (
                    <div key={t.id} className="flex items-center gap-4 px-5 py-3 border-t border-line first:border-t-0">
                      <span className="[font-family:var(--font-display)] font-extrabold text-[20px] leading-none text-fg-4 w-6 text-right shrink-0 [font-variant-numeric:tabular-nums]">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] text-fg font-medium">
                          {t.content || <span className="text-fg-4 italic">ohne Text</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="size-3 text-fg-3">{platformMeta(t.platform).icon}</span>
                          <span className="[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.1em] text-fg-4">
                            {platformMeta(t.platform).label}
                          </span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={bucketMeta(appOfItem(t)).icon} alt="" width={12} height={12} className="size-3 rounded-[3px]" />
                          <span className="[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.1em] text-fg-4">
                            {bucketMeta(appOfItem(t)).label}
                          </span>
                          {t.createdAt ? <span className="text-[11px] text-fg-4">{fmtRelative(t.createdAt)}</span> : null}
                        </div>
                      </div>
                      <div className="hidden sm:flex gap-4 shrink-0">
                        <MiniStat value={fmtCompact(t.metrics.views)} label="Views" />
                        <MiniStat value={fmtCompact(t.metrics.likes)} label="Likes" />
                        <MiniStat value={fmtCompact(t.metrics.comments)} label="Komm." />
                      </div>
                      {t.postUrl ? (
                        <a
                          href={t.postUrl}
                          target="_blank"
                          rel="noopener"
                          className="shrink-0 text-[12px] font-semibold text-fg-2 border-b border-line-strong hover:border-fg hover:text-fg"
                        >
                          ↗
                        </a>
                      ) : (
                        <span className="shrink-0 w-3" />
                      )}
                    </div>
                  ))}
                </Card>
              </>
            ) : null}

            <SectionHead>Historie</SectionHead>
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
                    <TableHead>App</TableHead>
                    <TableHead>Text</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPosts.map((p) => {
                    const badge = STATE_BADGE[p.state.type];
                    const m = metricsFor(p);
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
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={bucketMeta(appOfPost.get(p.id) ?? "studio").icon}
                              alt=""
                              width={14}
                              height={14}
                              className="size-3.5 rounded-[4px]"
                            />
                            <span className="[font-family:var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-fg-2">
                              {bucketMeta(appOfPost.get(p.id) ?? "studio").label}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[380px]">
                          <span className="block truncate text-[12.5px] text-fg-2" title={p.text}>
                            {p.text || <span className="text-fg-4 italic">ohne Text</span>}
                          </span>
                          {p.state.type === "failed" && p.state.errorMessage ? (
                            <span className="block truncate text-[11px] text-danger mt-0.5" title={p.state.errorMessage}>
                              {p.state.errorMessage}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right text-[12.5px] [font-variant-numeric:tabular-nums]">
                          {p.state.type === "published" ? (m ? fmtCompact(m.metrics.views) : "—") : ""}
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
                              title="Post öffnen"
                              className="text-[13px] font-semibold text-fg-2 hover:text-fg"
                            >
                              ↗
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
