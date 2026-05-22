// Funnel detail: 4-stage trapezoid visualization (Clicks → Installs →
// Buyers → Earnings) plus per-app drill-down. The trapezoid widths scale
// to the actual counts, conversion rate is labelled between stages.

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabaseAuth";
import {
  loadAffiliate,
  loadStatsForApp,
  eur,
  type AppStats,
} from "../_shared/dashboard-data";
import { PageHeader, Card } from "../_shared/ui";

export const dynamic = "force-dynamic";

export default async function FunnelPage() {
  const user = await getSessionUser();
  if (!user) redirect("/dashboard/login");

  const affiliate = await loadAffiliate(user.id);
  if (!affiliate) redirect("/dashboard");

  const stats: AppStats[] = (
    await Promise.all(affiliate.apps.map((slug) => loadStatsForApp(slug, affiliate.handles[slug] ?? "")))
  ).filter((s): s is AppStats => s !== null);

  const totalClicks = stats.reduce((s, x) => s + x.clicks, 0);
  const totalInstalls = stats.reduce((s, x) => s + x.installs, 0);
  const totalBuyers = stats.reduce((s, x) => s + x.conversions, 0);
  const totalEarned = stats.reduce((s, x) => s + x.matured_cents, 0);

  return (
    <>
      <PageHeader
        eyebrow="Funnel"
        title={<>Clicks <i style={{ fontFamily: "var(--font-editorial, serif)" }}>to</i> commission.</>}
        intro="How your bio-link traffic moves through the four steps of the attribution funnel. Wider step = more people, narrower = drop-off."
      />

      <Card eyebrow="Full funnel" title="All apps combined">
        <FunnelDiagram
          stages={[
            { label: "Clicks", value: totalClicks, suffix: "" },
            { label: "Installs", value: totalInstalls, suffix: "" },
            { label: "Premium buyers", value: totalBuyers, suffix: "" },
            { label: "Earned", value: totalEarned, suffix: " (€ cents)", display: eur(totalEarned) },
          ]}
        />
      </Card>

      {stats.length > 0 && (
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          {stats.map((s) => (
            <Card key={s.slug} eyebrow={s.appName} title={`@${s.handle}`}>
              <FunnelDiagram
                compact
                stages={[
                  { label: "Clicks", value: s.clicks },
                  { label: "Installs", value: s.installs },
                  { label: "Buyers", value: s.conversions },
                  { label: "Earned", value: s.matured_cents, display: eur(s.matured_cents) },
                ]}
              />
            </Card>
          ))}
        </div>
      )}

      <p style={{ marginTop: 24, fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.55 }}>
        Install-to-buyer conversion typically sits at 8 to 12 % for our apps. Clicks-to-installs depends on how warm the audience is — explainer Reels usually beat raw promo posts here.
      </p>
    </>
  );
}

// Server-rendered SVG: each stage is a trapezoid that narrows toward the
// next stage proportional to the count drop. Earnings get a EUR display
// override since they're cents-based and would skew the geometry.
interface Stage {
  label: string;
  value: number;
  suffix?: string;
  display?: string;
}

function FunnelDiagram({ stages, compact }: { stages: Stage[]; compact?: boolean }) {
  const width = 720;
  const stageHeight = compact ? 56 : 76;
  const gap = compact ? 4 : 8;
  const height = stages.length * stageHeight + (stages.length - 1) * gap;

  // The visual proportions use the first 3 stages (clicks, installs, buyers).
  // Earnings live in a different unit so they get the same width as buyers
  // visually but display the EUR string.
  const visualBase = Math.max(stages[0]?.value ?? 1, 1);
  const widths = stages.map((s, i) => {
    if (i === stages.length - 1) {
      // Earnings stage: use buyers ratio as its width to keep the trapezoid
      // shape readable even when value is in a different unit.
      const prev = stages[i - 1];
      if (prev && prev.value > 0) {
        return Math.max(60, (prev.value / visualBase) * width * 0.85);
      }
      return 60;
    }
    return Math.max(60, (s.value / visualBase) * width * 0.95);
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height + 28}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", display: "block", color: "var(--fg)" }}
    >
      <defs>
        <linearGradient id="funnelFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0.06} />
        </linearGradient>
      </defs>
      {stages.map((stage, i) => {
        const wTop = widths[i];
        const wBottom = widths[i + 1] ?? wTop * 0.6;
        const y = i * (stageHeight + gap);
        const xTopL = (width - wTop) / 2;
        const xTopR = xTopL + wTop;
        const xBotL = (width - wBottom) / 2;
        const xBotR = xBotL + wBottom;
        const path = `M ${xTopL} ${y} L ${xTopR} ${y} L ${xBotR} ${y + stageHeight} L ${xBotL} ${y + stageHeight} Z`;
        const display = stage.display ?? stage.value.toLocaleString("en-IE");
        const prev = stages[i - 1];
        const dropRate =
          prev && prev.value > 0 && i < stages.length - 1
            ? ((stage.value / prev.value) * 100).toFixed(1) + " %"
            : "";
        return (
          <g key={stage.label}>
            <path
              d={path}
              fill="url(#funnelFill)"
              stroke="currentColor"
              strokeOpacity={0.4}
              strokeWidth={1}
            />
            {/* Label inside the trapezoid */}
            <text
              x={width / 2}
              y={y + stageHeight / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: compact ? 10 : 11,
                letterSpacing: "1.4px",
                textTransform: "uppercase",
                fill: "currentColor",
                opacity: 0.78,
              }}
            >
              {stage.label}
            </text>
            <text
              x={width / 2}
              y={y + stageHeight / 2 + (compact ? 13 : 17)}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontFamily: "var(--font-display, system-ui)",
                fontSize: compact ? 16 : 22,
                fontWeight: 700,
                fill: "currentColor",
              }}
            >
              {display}
            </text>
            {/* Drop-rate label between stages */}
            {dropRate && (
              <text
                x={width - 8}
                y={y + 6}
                textAnchor="end"
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: compact ? 9 : 10,
                  fill: "currentColor",
                  opacity: 0.55,
                  letterSpacing: "0.6px",
                }}
              >
                ↓ {dropRate}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
