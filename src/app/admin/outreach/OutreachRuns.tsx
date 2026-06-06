"use client";

// Outreach run history on the shadcn Table. Read-only display: the page computes
// every row's strings + badge tones server-side (reusing the existing phase /
// stale logic) and passes plain data here. The only client bit is the per-row
// detail expander (useState). No mail/scrape logic lives here.

import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type RunBadgeTone = "ok" | "info" | "warn" | "danger" | "neutral";

export interface RunDetail {
  buckets: string;
  niche: string;
  duration: string;
  runIdShort: string;
  mailSubject: string | null;
  errorsJson: string | null;
}

export interface RunRowData {
  id: string;
  whenRel: string;
  apps: string[];
  language: string;
  platforms: string[];
  count: number;
  costEstimate: number | null;
  costActual: number | null;
  targetsAdded: number;
  mailsSent: number;
  duration: string;
  running: boolean;
  statusLabel: string;
  statusTone: RunBadgeTone;
  phaseLabel: string | null;
  phaseTone: RunBadgeTone | null;
  detail: RunDetail | null;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block [font-family:var(--font-mono)] text-[9px] px-1.5 py-px rounded-full border border-line-strong text-fg-2 bg-surface">
      {children}
    </span>
  );
}

export default function OutreachRuns({ runs, hasRunningWave }: { runs: RunRowData[]; hasRunningWave: boolean }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section className="mb-2">
      <div className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fg-3 mb-3 flex items-center gap-2.5 after:content-[''] after:flex-1 after:h-px after:bg-line">
        Letzte Wellen
      </div>

      {hasRunningWave && (
        <div className="inline-block text-[11px] text-fg-2 mb-2.5 px-2.5 py-1.5 bg-surface-2 border border-line rounded-[var(--radius-sm)]">
          Eine Welle läuft. Auto-Refresh aktivieren um Progress live zu sehen:{" "}
          <a className="font-semibold border-b border-line-strong hover:border-fg" href="?view=outreach&ar=1">
            15s live
          </a>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Wann</TableHead>
            <TableHead>Apps</TableHead>
            <TableHead>Region</TableHead>
            <TableHead>Platforms</TableHead>
            <TableHead className="text-right">Count</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Output / Dauer</TableHead>
            <TableHead>Status / Phase</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-fg-3 italic">
                noch keine Wellen gestartet
              </TableCell>
            </TableRow>
          ) : (
            runs.map((r) => (
              <Fragment key={r.id}>
                <TableRow>
                  <TableCell className="whitespace-nowrap">
                    {r.detail ? (
                      <button
                        type="button"
                        onClick={() => toggle(r.id)}
                        aria-label="Details"
                        className="inline-flex items-center justify-center size-5 mr-1.5 align-middle rounded border border-line text-fg-3 hover:bg-surface-2 hover:text-fg transition-colors"
                      >
                        <ChevronRight className={`size-3 transition-transform ${open.has(r.id) ? "rotate-90" : ""}`} />
                      </button>
                    ) : (
                      <span className="inline-block w-5 mr-1.5" />
                    )}
                    <span className="text-fg-3 text-[11px]">{r.whenRel}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">{r.apps.map((a) => <Pill key={a}>{a}</Pill>)}</div>
                  </TableCell>
                  <TableCell>
                    <Pill>{r.language.toUpperCase()}</Pill>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">{r.platforms.map((p) => <Pill key={p}>{p}</Pill>)}</div>
                  </TableCell>
                  <TableCell className="text-right">{r.count}/App</TableCell>
                  <TableCell className="text-right">
                    {r.costEstimate != null ? `$${r.costEstimate.toFixed(2)}` : "—"}
                    {r.costActual != null && <div className="text-fg-4 text-[10px]">actual ${r.costActual.toFixed(2)}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.targetsAdded} / {r.mailsSent} ✉
                    {r.duration !== "—" && <div className="text-fg-4 text-[10px]">{r.running ? `läuft ${r.duration}` : r.duration}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge tone={r.statusTone} dot>
                      {r.statusLabel}
                    </Badge>
                    {r.phaseLabel && r.phaseTone && (
                      <div className="mt-1">
                        <Badge tone={r.phaseTone}>{r.phaseLabel}</Badge>
                      </div>
                    )}
                  </TableCell>
                </TableRow>

                {r.detail && open.has(r.id) && (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-surface-2">
                      <div className="grid gap-2.5 text-[12px] [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                        <div>
                          <span className="[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.12em] text-fg-3">Buckets</span>
                          <div className="[font-family:var(--font-mono)] mt-0.5">{r.detail.buckets}</div>
                        </div>
                        <div>
                          <span className="[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.12em] text-fg-3">Niche</span>
                          <div className="mt-0.5">{r.detail.niche}</div>
                        </div>
                        <div>
                          <span className="[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.12em] text-fg-3">Dauer</span>
                          <div className="[font-family:var(--font-mono)] mt-0.5">{r.detail.duration}</div>
                        </div>
                        <div>
                          <span className="[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.12em] text-fg-3">Run-ID</span>
                          <div className="[font-family:var(--font-mono)] text-[10px] mt-0.5">{r.detail.runIdShort}…</div>
                        </div>
                      </div>
                      {r.detail.mailSubject && (
                        <div className="mt-3">
                          <span className="[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.12em] text-fg-3">Mail-Subject (Override)</span>
                          <div className="mt-1 [font-family:var(--font-mono)] text-[12px] text-fg-2">{r.detail.mailSubject}</div>
                        </div>
                      )}
                      {r.detail.errorsJson && (
                        <div className="mt-3">
                          <span className="[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.12em] text-danger">Errors / Notes</span>
                          <pre className="mt-2 px-3 py-2.5 bg-surface border border-line rounded-[var(--radius-sm)] [font-family:var(--font-mono)] text-[11px] text-fg-2 overflow-x-auto whitespace-pre-wrap">
                            {r.detail.errorsJson}
                          </pre>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}
