// Outreach KPI row, on the shadcn Card component. Pure presentational — the
// numbers come from getOutreachStats() in the server page. No client logic.

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export interface OutreachStatsLite {
  total: number;
  queued: number;
  mails_last_7d: number;
  mails_total: number;
  replied: number;
  converted: number;
  declined: number;
  response_rate_pct: number | null;
  converted_last_30d: number;
  conversion_rate_pct: number | null;
}

function Kpi({ k, v, s }: { k: string; v: ReactNode; s: string }) {
  return (
    <Card className="px-5 py-4">
      <div className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3">{k}</div>
      <div className="[font-family:var(--font-display)] font-extrabold text-[32px] leading-none tracking-[-0.03em] text-fg mt-2 [font-variant-numeric:tabular-nums]">{v}</div>
      <div className="text-[13px] text-fg-3 mt-2 font-medium">{s}</div>
    </Card>
  );
}

export default function OutreachKpis({ stats }: { stats: OutreachStatsLite }) {
  return (
    <div className="grid gap-3 mb-7 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
      <Kpi k="Total" v={stats.total} s="Targets im Tracker" />
      <Kpi k="Queued" v={stats.queued} s="noch nicht kontaktiert" />
      <Kpi k="Mails (7d)" v={stats.mails_last_7d} s={`${stats.mails_total} gesamt rausgeschickt`} />
      <Kpi k="Antworten" v={stats.replied + stats.converted + stats.declined} s={`${stats.response_rate_pct ?? "—"}% Response-Rate`} />
      <Kpi k="Converted (30d)" v={stats.converted_last_30d} s={`${stats.conversion_rate_pct ?? "—"}% Conversion-Rate`} />
    </div>
  );
}
