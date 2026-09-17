"use client";

// Daily users and app starts of one app, as the Tremor AreaChart the other
// analytics pages use. Pure presentation: the server page hands over the
// points, nothing here talks to PostHog.

import { AreaChart } from "../tremor/components/AreaChart/AreaChart";
import type { AvailableChartColorsKeys } from "../tremor/utils/chartColors";

export interface UsageChartPoint {
  label: string;
  users: number;
  starts: number;
}

const COLORS: AvailableChartColorsKeys[] = ["ink", "steel"];

export default function UsageChart({ points }: { points: UsageChartPoint[] }) {
  const data = points.map((p) => ({ label: p.label, Nutzer: p.users, "App-Starts": p.starts }));
  return (
    <AreaChart
      data={data}
      index="label"
      categories={["Nutzer", "App-Starts"]}
      colors={COLORS}
      valueFormatter={(v) => v.toLocaleString("de-CH")}
      showLegend
      startEndOnly
      allowDecimals={false}
      className="h-72"
    />
  );
}
