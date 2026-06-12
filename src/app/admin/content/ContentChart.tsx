"use client";

// Published-posts-over-time chart for /admin/content, stacked by platform.
// Pure presentational: the server page buckets the posts (day/week/month per
// range) and passes plain rows; colors are the Klar monochrome chart tokens.

import { BarChart } from "../tremor/components/BarChart/BarChart";

export interface ContentChartRow {
  label: string;
  [platform: string]: string | number;
}

export default function ContentChart({
  data,
  categories,
}: {
  data: ContentChartRow[];
  categories: string[];
}) {
  return (
    <BarChart
      data={data}
      index="label"
      categories={categories}
      colors={["ink", "steel", "silver"]}
      type="stacked"
      valueFormatter={(v: number) => String(Math.round(v))}
      allowDecimals={false}
      yAxisWidth={32}
      showLegend={categories.length > 1}
      className="h-56"
    />
  );
}
