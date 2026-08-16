"use client";

import { useMemo, useState } from "react";
import type { MrrPoint } from "@/lib/klarOsMrr";

// The change since the last snapshot, sitting next to the figure, and the whole
// recorded history behind one click.
//
// The comparison is against the previous SNAPSHOT, not against calendar
// yesterday: the nightly cron has missed a night before, and a missing day is a
// gap rather than a zero. When the two are not consecutive the label says the
// date instead of "yesterday", because a number that quietly measures something
// other than what it claims is worse than no number.

const money = (cents: number) => {
  const d = cents / 100;
  return `$${(Math.round(d * 100) / 100).toLocaleString("en-US", {
    maximumFractionDigits: d % 1 === 0 ? 0 : 2,
  })}`;
};

const isDayBefore = (earlier: string, later: string) => {
  const a = new Date(earlier + "T00:00:00Z").getTime();
  const b = new Date(later + "T00:00:00Z").getTime();
  return b - a === 86_400_000;
};

const niceDay = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

export default function MrrTrend({ series }: { series: MrrPoint[] }) {
  const [open, setOpen] = useState(false);

  const model = useMemo(() => {
    if (series.length < 2) return null;
    const last = series[series.length - 1];
    const prev = series[series.length - 2];
    const first = series[0];
    const max = Math.max(...series.map((p) => p.cents));
    const min = Math.min(...series.map((p) => p.cents));

    // The chart is drawn on a 0-based axis: this is money, and a truncated
    // baseline makes a four dollar step look like a doubling.
    const W = 640;
    const H = 120;
    const x = (i: number) => (series.length === 1 ? 0 : (i / (series.length - 1)) * W);
    const y = (c: number) => H - (max === 0 ? 0 : (c / max) * (H - 8));
    // Stepped, not smoothed: the value is a daily reading that holds until the
    // next one, and a curve between two readings invents days that were never
    // measured.
    let d = `M 0 ${y(series[0].cents)}`;
    series.forEach((p, i) => {
      if (i === 0) return;
      d += ` L ${x(i)} ${y(series[i - 1].cents)} L ${x(i)} ${y(p.cents)}`;
    });
    const area = `${d} L ${W} ${H} L 0 ${H} Z`;

    return {
      last,
      prev,
      first,
      max,
      min,
      delta: last.cents - prev.cents,
      consecutive: isDayBefore(prev.day, last.day),
      line: d,
      area,
      W,
      H,
      days: series.length,
    };
  }, [series]);

  if (!model) return null;

  const { delta, prev, last, first, consecutive } = model;
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  const label = consecutive ? "since yesterday" : `since ${niceDay(prev.day)}`;

  return (
    <span className="mrrtrend">
      <button
        type="button"
        className={`mrrtrend-chip${delta > 0 ? " is-up" : delta < 0 ? " is-down" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mrr-history"
      >
        {delta === 0 ? "level" : `${sign}${money(Math.abs(delta))}`} {label}
        <i aria-hidden="true">{open ? "−" : "+"}</i>
      </button>

      <span
        id="mrr-history"
        className="mrrtrend-panel"
        hidden={!open}
        role="region"
        aria-label="Recorded revenue history"
      >
        <span className="mrrtrend-facts">
          <span>
            <b>{money(first.cents)}</b> on {niceDay(first.day)}
          </span>
          <i aria-hidden="true">&rarr;</i>
          <span>
            <b>{money(last.cents)}</b> on {niceDay(last.day)}
          </span>
          <em>
            {model.days} snapshots, {first.subscriptions} to {last.subscriptions} subscriptions
          </em>
        </span>

        <svg
          className="mrrtrend-chart"
          viewBox={`0 0 ${model.W} ${model.H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Monthly revenue from ${money(first.cents)} on ${niceDay(
            first.day,
          )} to ${money(last.cents)} on ${niceDay(last.day)}, across ${model.days} daily snapshots.`}
        >
          <path className="mrrtrend-area" d={model.area} />
          <path className="mrrtrend-line" d={model.line} />
        </svg>

        <span className="mrrtrend-axis">
          <span>{niceDay(first.day)}</span>
          <span>{niceDay(last.day)}</span>
        </span>
      </span>
    </span>
  );
}
