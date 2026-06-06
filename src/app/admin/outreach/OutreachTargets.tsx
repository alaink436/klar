"use client";

// Outreach targets table, rebuilt on the shadcn Table/Badge/Button kit (was a
// raw HTML string in page.tsx). Pure presentation + native form POSTs — every
// action hits the SAME existing route with the SAME fields, so the pipeline is
// untouched:
//   status quick-actions → /admin/outreach/update
//   mail counter         → /admin/outreach/mark-mail
//   decline (+ suppress) → /admin/outreach/decline   (data-klar-confirm)
//   delete               → /admin/outreach/delete    (data-klar-confirm)
//   metrics edit         → /admin/outreach/update-metrics
// The decline/delete confirm dialogs are bound by the layout-level MODAL_SCRIPT
// (its MutationObserver picks these up after render). The per-row metrics editor
// is the only interactive bit, held in local state instead of inline onclick.

import { Fragment, useState } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OutreachTarget, OutreachStatus } from "@/lib/outreachStore";

type Tone = "neutral" | "ok" | "info" | "warn" | "danger";

const PLATFORM_LABEL: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram" };
const STATUS_META: Record<OutreachStatus, { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "neutral" },
  dm_sent: { label: "DM gesendet", tone: "info" },
  replied: { label: "Geantwortet", tone: "warn" },
  declined: { label: "Abgelehnt", tone: "neutral" },
  converted: { label: "Converted", tone: "ok" },
  dead: { label: "Dead", tone: "neutral" },
};

function fmtFollowers(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}
function fmtBigNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}
function fmtRel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) {
    const hrs = Math.floor(diff / 3_600_000);
    if (hrs < 1) {
      const min = Math.floor(diff / 60_000);
      return min <= 1 ? "gerade eben" : `vor ${min} Min`;
    }
    return `vor ${hrs} Std`;
  }
  if (days < 2) return "gestern";
  if (days < 30) return `vor ${days} Tg`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return `vor ${mo} Mon`;
  return `vor ${Math.floor(mo / 12)} J`;
}

// Forward-only status transitions, mirroring the old quick-action arrows.
function nextActions(status: OutreachStatus): { label: string; status: OutreachStatus }[] {
  if (status === "queued") return [{ label: "DM ✓", status: "dm_sent" }];
  if (status === "dm_sent") return [{ label: "Antwort", status: "replied" }, { label: "Dead", status: "dead" }];
  if (status === "replied") return [{ label: "Converted", status: "converted" }];
  return [];
}

const MINI =
  "inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-line-strong bg-surface text-fg-2 px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors hover:bg-surface-2 hover:text-fg";

export default function OutreachTargets({
  targets,
  filterActive,
}: {
  targets: OutreachTarget[];
  filterActive: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (targets.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-dashed border-line-strong bg-surface px-6 py-10 text-center text-fg-3">
        <div className="font-semibold text-fg-2 text-sm mb-1">Keine Targets in dieser Auswahl</div>
        <div className="text-[13px]">
          {filterActive ? (
            <Link className="applink" href="/admin/outreach">Filter zurücksetzen</Link>
          ) : (
            "Füg einen mit dem Formular oben hinzu."
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-line">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lead</TableHead>
            <TableHead>Plattform</TableHead>
            <TableHead className="text-right">Follower</TableHead>
            <TableHead className="text-right">Views</TableHead>
            <TableHead>Apps</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {targets.map((t) => {
            const sm = STATUS_META[t.status] ?? { label: t.status, tone: "neutral" as Tone };
            const showDecline = t.status === "dm_sent" || t.status === "replied";
            return (
              <Fragment key={t.id}>
                <TableRow>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenId((id) => (id === t.id ? null : t.id))}
                        className="mt-0.5 shrink-0 rounded-[var(--radius-sm)] border border-line-strong bg-surface px-1.5 text-fg-3 text-[11px] hover:bg-surface-2 hover:text-fg"
                        title="Metriken bearbeiten"
                        aria-expanded={openId === t.id}
                      >
                        {openId === t.id ? "▾" : "▸"}
                      </button>
                      <div className="min-w-0">
                        {t.profile_url ? (
                          <a className="applink font-semibold" href={t.profile_url} target="_blank" rel="noopener">
                            @{t.handle}
                          </a>
                        ) : (
                          <span className="font-semibold">@{t.handle}</span>
                        )}
                        {(t.display_name || t.niche) && (
                          <div className="text-fg-3 text-[11px] mt-0.5">
                            {t.display_name ?? ""} {t.niche ? `· ${t.niche}` : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge tone="neutral">{PLATFORM_LABEL[t.platform] ?? t.platform}</Badge>
                  </TableCell>
                  <TableCell className="text-right [font-variant-numeric:tabular-nums]">{fmtFollowers(t.follower_estimate)}</TableCell>
                  <TableCell className="text-right [font-variant-numeric:tabular-nums]">
                    <span title="Total Views">{fmtBigNum(t.total_views_estimate)}</span>
                    {t.avg_views_per_post ? <div className="text-fg-3 text-[10px]">Ø {fmtBigNum(t.avg_views_per_post)}/post</div> : null}
                    {t.engagement_rate_pct ? <div className="text-fg-3 text-[10px]">{t.engagement_rate_pct}% eng.</div> : null}
                  </TableCell>
                  <TableCell>
                    {t.for_apps && t.for_apps.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {t.for_apps.map((a) => (
                          <Badge key={a} tone="neutral">{a}</Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-fg-3 text-[11px]">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge tone={sm.tone} dot>{sm.label}</Badge>
                    <div className="text-fg-3 text-[10px] mt-0.5">{fmtRel(t.updated_at)}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                      {nextActions(t.status).map((a) => (
                        <form key={a.status} method="POST" action="/admin/outreach/update" className="inline">
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="status" value={a.status} />
                          <button type="submit" className={MINI}>{a.label}</button>
                        </form>
                      ))}
                      <form
                        method="POST"
                        action="/admin/outreach/mark-mail"
                        className="inline"
                        title={`${t.mails_sent} Mail(s) bisher${t.last_mail_at ? `, zuletzt ${fmtRel(t.last_mail_at)}` : ""}`}
                      >
                        <input type="hidden" name="id" value={t.id} />
                        <button type="submit" className={MINI}>✉ {t.mails_sent}</button>
                      </form>
                      {showDecline && (
                        <details className="inline-block align-middle">
                          <summary className={`${MINI} list-none`}>Ablehnen</summary>
                          <form
                            method="POST"
                            action="/admin/outreach/decline"
                            className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-[var(--radius-sm)] border border-line bg-surface-2 p-2.5"
                            data-klar-confirm={`Status wird auf 'declined' gesetzt. Bei aktivierter Suppression wird @${t.handle} in zukünftigen Wellen übersprungen.`}
                            data-klar-confirm-title={`@${t.handle} ablehnen?`}
                            data-klar-confirm-variant="warn"
                            data-klar-confirm-ok="Ablehnen"
                          >
                            <input type="hidden" name="id" value={t.id} />
                            <input
                              type="text"
                              name="reason"
                              maxLength={280}
                              placeholder="Grund (optional, intern)"
                              className="min-w-[200px] rounded-[5px] border border-line bg-surface px-2 py-1 text-[12px] text-fg"
                            />
                            <label className="inline-flex items-center gap-1.5 text-[11px] text-fg-2 cursor-pointer [font-family:var(--font-mono)] uppercase tracking-[0.06em]" title="Influencer auf Suppression-Liste setzen">
                              <input type="checkbox" name="suppress" value="1" defaultChecked className="cursor-pointer" />
                              Suppress
                            </label>
                            <button type="submit" className={MINI}>Ablehnen</button>
                          </form>
                        </details>
                      )}
                      <form
                        method="POST"
                        action="/admin/outreach/delete"
                        className="inline"
                        data-klar-confirm="Lead wird komplett aus der Outreach-Tabelle entfernt. Falls bereits eine Mail rausging, bleibt die in der Inbox des Influencers."
                        data-klar-confirm-title={`@${t.handle} löschen?`}
                        data-klar-confirm-variant="danger"
                        data-klar-confirm-ok="Lead löschen"
                      >
                        <input type="hidden" name="id" value={t.id} />
                        <button type="submit" className={`${MINI} text-danger`} title="Hard delete">✕</button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>

                {openId === t.id && (
                  <TableRow>
                    <TableCell colSpan={7} className="bg-surface-2">
                      <form
                        method="POST"
                        action="/admin/outreach/update-metrics"
                        className="flex flex-wrap items-end gap-2 [font-family:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-fg-3"
                      >
                        <input type="hidden" name="id" value={t.id} />
                        <label className="flex flex-col">Follower
                          <input type="number" name="follower_estimate" min={0} max={100000000} defaultValue={t.follower_estimate ?? ""} className="mt-1 w-[110px] rounded-[5px] border border-line-strong bg-bg px-2 py-1 text-[12px] text-fg" />
                        </label>
                        <label className="flex flex-col">Total-Views
                          <input type="number" name="total_views_estimate" min={0} max={100000000000} defaultValue={t.total_views_estimate ?? ""} className="mt-1 w-[130px] rounded-[5px] border border-line-strong bg-bg px-2 py-1 text-[12px] text-fg" />
                        </label>
                        <label className="flex flex-col">Ø Views/Post
                          <input type="number" name="avg_views_per_post" min={0} max={100000000} defaultValue={t.avg_views_per_post ?? ""} className="mt-1 w-[110px] rounded-[5px] border border-line-strong bg-bg px-2 py-1 text-[12px] text-fg" />
                        </label>
                        <label className="flex flex-col">Engagement %
                          <input type="number" name="engagement_rate_pct" min={0} max={100} step={0.01} defaultValue={t.engagement_rate_pct ?? ""} className="mt-1 w-[90px] rounded-[5px] border border-line-strong bg-bg px-2 py-1 text-[12px] text-fg" />
                        </label>
                        <Button type="submit" size="sm">Speichern</Button>
                      </form>
                      {t.notes ? <div className="mt-2.5 text-fg-3 text-[12px] [font-family:var(--font-body)] italic">{t.notes}</div> : null}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
