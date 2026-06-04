"use client";

// Affiliate-/Outreach-table for the overview, built on the real
// @tanstack/react-table (headless). Sorting + column model come from the
// library; the markup reuses the shared admin .card-table / .tbadge classes so
// it stays inside the token design system. Data arrives pre-formatted and
// serialisable from the server component (no functions cross the boundary).

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";

export interface OverviewRow {
  slug: string;
  name: string;
  onboarded: boolean;
  total: number;
  active: number;
  angefragt: number;
  reply: number;
  angenommen: number;
  openCents: number;
  openFmt: string;
}

function Count({ n, tone }: { n: number; tone: "neutral" | "warn" | "ok" }) {
  if (n === 0) return <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>0</span>;
  const color = tone === "warn" ? "var(--warning)" : tone === "ok" ? "var(--success)" : "var(--fg-2)";
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{n}</span>
  );
}

const col = createColumnHelper<OverviewRow>();

const columns = [
  col.accessor("name", {
    header: "App",
    enableSorting: true,
    cell: (c) => (
      <>
        <a className="applink" href={`/admin?view=${encodeURIComponent(c.row.original.slug)}`}>{c.getValue()}</a>
        {c.row.original.onboarded ? null : <span className="pill" style={{ marginLeft: 8 }}>nicht ausgerollt</span>}
      </>
    ),
  }),
  col.accessor("total", { header: "Affiliates", meta: { align: "right" } }),
  col.accessor("active", { header: "Aktiv", meta: { align: "right" } }),
  col.accessor("angefragt", { header: "Angefragt", meta: { align: "center" }, cell: (c) => <Count n={c.getValue()} tone="neutral" /> }),
  col.accessor("reply", { header: "Antwort", meta: { align: "center" }, cell: (c) => <Count n={c.getValue()} tone="warn" /> }),
  col.accessor("angenommen", { header: "Angenommen", meta: { align: "center" }, cell: (c) => <Count n={c.getValue()} tone="ok" /> }),
  col.accessor("openCents", {
    header: "Offen",
    meta: { align: "right" },
    cell: (c) => c.row.original.openFmt,
  }),
  col.display({
    id: "action",
    header: "",
    cell: (c) => (
      <a className="applink" href={`/admin?view=${encodeURIComponent(c.row.original.slug)}`} style={{ fontSize: 12 }}>öffnen →</a>
    ),
  }),
];

function SortCaret({ dir }: { dir: false | "asc" | "desc" }) {
  return (
    <span style={{ display: "inline-flex", width: 10, marginLeft: 5, opacity: dir ? 1 : 0.25, verticalAlign: "middle" }}>
      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        {dir === "asc" ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}
      </svg>
    </span>
  );
}

export default function OverviewAffiliateTable({ rows }: { rows: OverviewRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <table className="card-table">
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((h) => {
              const align = (h.column.columnDef.meta as { align?: string } | undefined)?.align ?? "left";
              const sortable = h.column.getCanSort();
              return (
                <th
                  key={h.id}
                  className={align === "right" ? "r" : align === "center" ? "c" : ""}
                  onClick={sortable ? h.column.getToggleSortingHandler() : undefined}
                  style={{ cursor: sortable ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap" }}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {sortable ? <SortCaret dir={h.column.getIsSorted()} /> : null}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((r) => (
          <tr key={r.id}>
            {r.getVisibleCells().map((cell) => {
              const align = (cell.column.columnDef.meta as { align?: string } | undefined)?.align ?? "left";
              return (
                <td key={cell.id} className={align === "right" ? "r" : align === "center" ? "c" : ""}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
