"use client";

// Client-side recharts line chart for monthly earnings. Kept thin: pure
// presentation, no data-fetching. Server builds the array, passes it in.

import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface ChartPoint {
  label: string;
  earnings: number; // EUR (not cents)
}

export function EarningsChart({ data }: { data: ChartPoint[] }) {
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="earningsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.32} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="rgba(255,255,255,0.4)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            dy={6}
          />
          <YAxis
            stroke="rgba(255,255,255,0.4)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => `€${v}`}
          />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.18)" }}
            contentStyle={{
              background: "rgba(20,20,22,0.96)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 8,
              fontSize: 12,
              color: "#fafafa",
            }}
            formatter={(v) => [`€${typeof v === "number" ? v : 0}`, "Earnings"] as [string, string]}
            labelStyle={{ color: "rgba(255,255,255,0.7)" }}
          />
          <Area
            type="monotone"
            dataKey="earnings"
            stroke="currentColor"
            strokeWidth={2}
            fill="url(#earningsFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
