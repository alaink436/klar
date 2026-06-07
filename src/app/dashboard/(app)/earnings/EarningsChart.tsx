"use client";

// Client-side recharts area chart for monthly earnings. Kept thin: pure
// presentation, no data-fetching. Server builds the array, passes it in.
// Colours are tuned for the light dashboard; the line/fill follow currentColor
// (var(--fg)) so they stay in sync with the theme.

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

export function EarningsChart({ data, height = 260 }: { data: ChartPoint[]; height?: number }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="earningsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(0,0,0,0.07)" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="rgba(0,0,0,0.4)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            dy={6}
          />
          <YAxis
            stroke="rgba(0,0,0,0.4)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => `€${v}`}
          />
          <Tooltip
            cursor={{ stroke: "rgba(0,0,0,0.18)" }}
            contentStyle={{
              background: "rgba(255,255,255,0.97)",
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: 8,
              fontSize: 12,
              color: "#18181b",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
            formatter={(v) => [`€${typeof v === "number" ? v : 0}`, "Earnings"] as [string, string]}
            labelStyle={{ color: "rgba(0,0,0,0.6)" }}
          />
          <Area
            type="monotone"
            dataKey="earnings"
            stroke="currentColor"
            strokeWidth={2}
            fill="url(#earningsFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
