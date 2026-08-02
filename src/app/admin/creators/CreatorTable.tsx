"use client";

// Creator list for /admin/creators. Client component so status filtering and
// the search box are instant — the server ships every row once (a few hundred
// at most) and filtering happens in memory, same trade-off the outreach target
// table makes.
//
// Status changes POST to /admin/creators/status; the confirm modal from the
// admin layout binds itself to the data-klar-confirm forms automatically.

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
// From creatorTypes, NOT creatorStore: the store is server-only, and importing
// it here would drag `server-only` into the client bundle.
import {
  CREATOR_STATUSES, CREATOR_STATUS_LABEL,
  type Creator, type CreatorStatus,
} from "@/lib/creatorTypes";

export interface CreatorRow extends Creator {
  /** Display name of the chosen app, resolved server-side from KLAR_APPS. */
  appLabel: string;
  /** Posts on record for this creator (all time). */
  postCount: number;
}

// Maps onto the Badge component's Tremor variants (default/neutral/success/
// error/warning) — no custom colour classes, so the badges match every other
// status badge in the admin.
const STATUS_VARIANT: Record<CreatorStatus, "default" | "neutral" | "success" | "error" | "warning"> = {
  applied: "default",
  active: "success",
  paused: "neutral",
  blocked: "error",
};

// Which status changes are worth one click, per current status. Deliberately
// not every transition — the useful moves are activate, pause, and kill.
const NEXT_ACTIONS: Record<CreatorStatus, CreatorStatus[]> = {
  applied: ["active", "blocked"],
  active: ["paused", "blocked"],
  paused: ["active", "blocked"],
  blocked: ["active"],
};

const ACTION_LABEL: Record<CreatorStatus, string> = {
  active: "Aktivieren",
  paused: "Pausieren",
  blocked: "Sperren",
  applied: "Zurücksetzen",
};

export default function CreatorTable({ rows }: { rows: CreatorRow[] }) {
  const [status, setStatus] = useState<CreatorStatus | "all">("all");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const s of CREATOR_STATUSES) c[s] = rows.filter((r) => r.status === s).length;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!needle) return true;
      return (
        r.handle.toLowerCase().includes(needle) ||
        (r.display_name ?? "").toLowerCase().includes(needle) ||
        (r.source ?? "").toLowerCase().includes(needle) ||
        r.appLabel.toLowerCase().includes(needle)
      );
    });
  }, [rows, status, q]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <nav className="inline-flex items-center gap-1 p-1 rounded-[var(--radius-sm)] bg-surface-2 border border-line flex-wrap">
          {(["all", ...CREATOR_STATUSES] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              aria-current={status === s ? "true" : undefined}
              style={status === s ? { backgroundColor: "var(--fg)", color: "var(--accent-fg)" } : undefined}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[calc(var(--radius-sm)-2px)] transition-colors [font-family:var(--font-mono)] text-[11px] font-semibold tracking-[0.08em] uppercase",
                status === s ? "bg-fg text-accent-fg" : "text-fg-3 hover:text-fg-2 hover:bg-surface",
              )}
            >
              {s === "all" ? "Alle" : CREATOR_STATUS_LABEL[s]}
              <span className="opacity-60">{counts[s] ?? 0}</span>
            </button>
          ))}
        </nav>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Handle, Kanal, App …"
          className="h-[34px] px-3 rounded-[var(--radius-sm)] bg-surface border border-line text-[13px] text-fg placeholder:text-fg-3 min-w-[200px]"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>
          {rows.length === 0
            ? "Noch keine Creator. Der erste kommt über Phase 0 — von Hand angelegt, Tracking-Link aus /admin/affiliate-create."
            : "Kein Treffer für diesen Filter."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Creator</TableHead>
              <TableHead>App</TableHead>
              <TableHead>Kanal (Herkunft)</TableHead>
              <TableHead className="text-right">Posts</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <span className="font-semibold">@{r.handle}</span>
                  {r.display_name ? (
                    <span className="muted block text-[11.5px]">{r.display_name}</span>
                  ) : null}
                </TableCell>
                <TableCell>{r.appLabel}</TableCell>
                <TableCell className="text-[12px] text-fg-2">
                  {r.source ?? <span className="muted">—</span>}
                </TableCell>
                <TableCell className="text-right [font-family:var(--font-mono)] [font-variant-numeric:tabular-nums]">
                  {r.postCount}
                </TableCell>
                <TableCell className="text-[12px]">
                  {r.tracking_url ? (
                    <a href={r.tracking_url} target="_blank" rel="noopener">
                      {r.tracking_handle ? `@${r.tracking_handle}` : "Link"} ↗
                    </a>
                  ) : (
                    <span className="muted">kein Link</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[r.status]}>
                    {CREATOR_STATUS_LABEL[r.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {NEXT_ACTIONS[r.status].map((next) => (
                    <form
                      key={next}
                      method="post"
                      action="/admin/creators/status"
                      className="inline-block ml-1.5"
                      data-klar-confirm={
                        next === "blocked"
                          ? `@${r.handle} sperren? Der Tracking-Link bleibt bestehen, der Creator gilt aber als abgeschaltet.`
                          : undefined
                      }
                    >
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value={next} />
                      <button
                        type="submit"
                        className="text-[11.5px] px-2.5 py-1 rounded-[var(--radius-sm)] border border-line text-fg-2 hover:text-fg hover:border-line-strong transition-colors"
                      >
                        {ACTION_LABEL[next]}
                      </button>
                    </form>
                  ))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
