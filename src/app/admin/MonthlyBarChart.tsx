"use client";

// Monthly affiliate revenue vs payout, rendered with the official Tremor
// BarChart (grouped, two series). Shared by overview + revenue. Values arrive
// in cents and the reporting currency as a prop, so no server-only imports
// cross into this client component.

import { BarChart } from "./tremor/components/BarChart/BarChart";

export interface MonthPoint {
  label: string;
  gross: number; // cents
  payout: number; // cents
}

export default function MonthlyBarChart({
  series,
  currency,
}: {
  series: MonthPoint[];
  currency: string;
}) {
  const data = series.map((d) => ({
    label: d.label,
    "Affiliate-Umsatz": Math.max(0, d.gross) / 100,
    Auszahlung: Math.max(0, d.payout) / 100,
  }));
  const fmt = (v: number) =>
    v.toLocaleString("de-CH", { style: "currency", currency, maximumFractionDigits: 0 });

  return (
    <div className="chart">
      <BarChart
        data={data}
        index="label"
        categories={["Affiliate-Umsatz", "Auszahlung"]}
        colors={["ink", "steel"]}
        valueFormatter={fmt}
        yAxisWidth={64}
        showLegend
        className="h-64"
      />
    </div>
  );
}
