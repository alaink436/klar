// Suppression list (do-not-contact) on the shadcn kit. Replaces the old
// suppressionSection HTML string. Server component: the add row is a native POST
// to /admin/outreach/suppression-add, the table renders plain row data computed
// in page.tsx. No client state needed.

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface SuppressionRowData {
  whenRel: string;
  handle: string;
  platform: string;
  reason: string;
  source: string;
  email: string;
  notes: string;
}

const REASONS: { value: string; label: string }[] = [
  { value: "manual", label: "Manuell (Admin-Entscheidung)" },
  { value: "stop_request", label: "STOP-Antwort vom Creator" },
  { value: "bounce", label: "Mail-Bounce (Brevo)" },
  { value: "spam_complaint", label: "Spam-Complaint" },
  { value: "opted_out", label: "Explizit opted-out" },
  { value: "invalid", label: "Ungültiger Handle/Email" },
  { value: "double_ask", label: "Schon vorher angefragt" },
];

const inputCls =
  "w-full px-3 py-2 text-sm bg-bg text-fg border border-line-strong rounded-[var(--radius-sm)] focus:border-fg focus:outline-none";
const labelCls = "[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-3";

export default function OutreachSuppressions({ rows }: { rows: SuppressionRowData[] }) {
  return (
    <Card className="p-0 overflow-hidden mt-8">
      <details>
        <summary className="cursor-pointer px-5 py-3.5 flex items-center justify-between gap-3 select-none marker:content-none">
          <span className="font-bold text-[14px] text-fg">
            Suppression-List <span className="text-fg-4 font-normal text-[11px] ml-1">do-not-contact, {rows.length} Einträge</span>
          </span>
          <span className="[font-family:var(--font-mono)] text-[11px] text-fg-3">n8n: POST /api/outreach/check-suppression</span>
        </summary>
        <div className="px-5 pb-5">
          <form method="POST" action="/admin/outreach/suppression-add" className="grid grid-cols-1 md:grid-cols-[1.5fr_0.9fr_1.2fr_1.5fr_auto] gap-3 items-end mb-5">
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Handle (ohne @)</span>
              <input name="handle" required maxLength={80} placeholder="sammyknits" className={`${inputCls} [font-family:var(--font-mono)]`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Plattform</span>
              <select name="platform" defaultValue="*" className={inputCls}>
                <option value="*">Beide</option><option value="tiktok">TikTok</option><option value="instagram">Instagram</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Grund</span>
              <select name="reason" className={inputCls}>
                {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Notiz (optional)</span>
              <input name="notes" maxLength={500} placeholder="z.B. Replied 'no thanks'" className={inputCls} />
            </label>
            <button type="submit" className="px-3.5 py-2 text-[13px] border border-line-strong rounded-[var(--radius-sm)] bg-surface text-fg hover:bg-surface-2">+ Sperren</button>
          </form>
          {rows.length === 0 ? (
            <div className="text-fg-4 italic text-[12px] py-3 text-center">Noch keine Suppressions. Cold-DM-Pipeline läuft offen.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Wann</TableHead><TableHead>Handle</TableHead><TableHead>Plattform</TableHead><TableHead>Grund / Quelle</TableHead><TableHead>Email / Notiz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={`${r.handle}-${i}`}>
                    <TableCell className="text-fg-4 text-[11px] whitespace-nowrap">{r.whenRel}</TableCell>
                    <TableCell className="[font-family:var(--font-mono)] text-[12px]">@{r.handle}</TableCell>
                    <TableCell><Badge tone="neutral">{r.platform}</Badge></TableCell>
                    <TableCell>
                      <Badge tone="neutral">{r.reason}</Badge>
                      <div className="text-fg-4 text-[10px] mt-0.5">{r.source}</div>
                    </TableCell>
                    <TableCell className="text-fg-3 text-[11px]">
                      {r.email || "—"}
                      {r.notes && <div className="text-[10px] italic mt-0.5">{r.notes}</div>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </details>
    </Card>
  );
}
