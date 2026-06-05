"use client";

// Per-app revenue table on @tanstack/react-table (headless). Money columns
// sort by raw cents, display a pre-formatted string. Markup reuses the shared
// .card-table classes so it matches the admin token system.

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";

export interface RevenueRow {
  slug: string;
  name: string;
  affiliates: number;
  grossCents: number;
  grossFmt: string;
  payoutCents: number;
  payoutFmt: string;
  openCents: number;
  openFmt: string;
}

const col = createColumnHelper<RevenueRow>();

const columns = [
  col.accessor("name", {
    header: "App",
    cell: (c) => <a className="applink" href={`/admin?view=${encodeURIComponent(c.row.original.slug)}`}>{c.getValue()}</a>,
  }),
  col.accessor("affiliates", { header: "Affiliates", meta: { align: "right" } }),
  col.accessor("grossCents", { header: "Affiliate-Umsatz", meta: { align: "right" }, cell: (c) => c.row.original.grossFmt }),
  col.accessor("payoutCents", { header: "Auszahlung verbucht", meta: { align: "right" }, cell: (c) => c.row.original.payoutFmt }),
  col.accessor("openCents", { header: "Offen", meta: { align: "right" }, cell: (c) => c.row.original.openFmt }),
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

export default function RevenueAffiliateTable({ rows }: { rows: RevenueRow[] }) {
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
