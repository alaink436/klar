"use client";

// Collab-Anfragen im Outreach-Menü: wer schreibt an die öffentlichen per-App
// Mail-Adressen (TikTok-Bio, z.B. animevault@reply.getklar.org)? Read-only-Sicht
// auf die klar_collab_messages-Threads (Daten kommen aus page.tsx via
// listCollabThreads) plus die Adress-Liste zum Kopieren für die Bios.
// Antworten laufen weiterhin über die Inbox — jede Zeile deep-linkt dorthin
// (?f=collab&sel=<thread>).

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface CollabAliasRow {
  appName: string;
  address: string;
}

export interface CollabThreadRow {
  contactEmail: string;
  contactName: string | null;
  appName: string;
  address: string | null;
  lastSubject: string | null;
  lastSnippet: string;
  inboundCount: number;
  unanswered: boolean;
  whenRel: string;
  inboxHref: string;
}

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(address).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title="Adresse kopieren"
      className="[font-family:var(--font-mono)] text-[12px] px-2.5 py-1 border border-line-strong rounded-[var(--radius-sm)] bg-surface text-fg hover:bg-surface-2 transition-colors"
    >
      {copied ? "✓ kopiert" : address}
    </button>
  );
}

export default function OutreachCollabs({
  aliases,
  threads,
}: {
  aliases: CollabAliasRow[];
  threads: CollabThreadRow[];
}) {
  const open = threads.filter((t) => t.unanswered).length;
  return (
    <>
      {/* Bio-Adressen: eine pro App, klick = kopieren (für TikTok/IG-Bios). */}
      <Card className="p-5 mb-6">
        <div className="font-bold text-[14px] text-fg mb-1">Öffentliche Collab-Adressen</div>
        <p className="text-fg-3 text-[12px] mb-4">
          Diese Adressen gehören in die TikTok/IG-Bios. Eingehende Mails landen automatisch hier
          und in der Inbox unter „Collabs&#8220;. Klick auf eine Adresse kopiert sie.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-3">
          {aliases.map((a) => (
            <div key={a.address} className="flex items-center gap-2">
              <span className="[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-3">
                {a.appName}
              </span>
              <CopyAddress address={a.address} />
            </div>
          ))}
        </div>
      </Card>

      {/* Eingegangene Anfragen */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between gap-3 border-b border-line">
          <span className="font-bold text-[14px] text-fg">
            Collab-Anfragen{" "}
            <span className="text-fg-4 font-normal text-[11px] ml-1">
              {threads.length} Thread{threads.length === 1 ? "" : "s"}
              {open > 0 ? ` · ${open} unbeantwortet` : ""}
            </span>
          </span>
          <Link href="/admin/inbox?f=collab" className="applink text-[12px]">
            In der Inbox öffnen →
          </Link>
        </div>
        {threads.length === 0 ? (
          <div className="text-fg-4 italic text-[12px] py-8 text-center">
            Noch keine Anfragen. Sobald jemand an eine der Bio-Adressen schreibt, taucht sie hier auf.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Wann</TableHead>
                <TableHead>Von</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Letzte Nachricht</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {threads.map((t) => (
                <TableRow key={t.inboxHref}>
                  <TableCell className="text-fg-4 text-[11px] whitespace-nowrap">{t.whenRel}</TableCell>
                  <TableCell>
                    <div className="text-[13px] text-fg">{t.contactName || t.contactEmail.split("@")[0]}</div>
                    <div className="[font-family:var(--font-mono)] text-[11px] text-fg-3">{t.contactEmail}</div>
                  </TableCell>
                  <TableCell><Badge tone="neutral">{t.appName}</Badge></TableCell>
                  <TableCell className="max-w-[340px]">
                    {t.lastSubject && (
                      <div className="text-[12px] font-semibold text-fg-2 truncate">{t.lastSubject}</div>
                    )}
                    <div className="text-[12px] text-fg-3 truncate">{t.lastSnippet || "—"}</div>
                  </TableCell>
                  <TableCell>
                    {t.unanswered
                      ? <Badge tone="warn">offen</Badge>
                      : <Badge tone="ok">beantwortet</Badge>}
                    <div className="text-fg-4 text-[10px] mt-0.5">
                      {t.inboundCount} eingehend
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Link href={t.inboxHref} className="applink text-[12px]">Antworten →</Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
