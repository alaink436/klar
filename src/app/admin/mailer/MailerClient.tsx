"use client";

// Klar Control · Mailer (client). Drives the in-app outreach mailer for Mail-1
// (cold first contact) only: dry-run preview + env-gated real send via
// /admin/mailer/run. Mail-2 / detail mail is sent on-demand from the reply flow.
//
// Rebuilt on the shadcn/ui kit (Button/Badge/Card/Table, lucide icons). After a
// real send it calls router.refresh() so the surrounding server data (dueMail1,
// inbox counts) updates without a manual reload. Renders inside the inbox
// "Welle mailen" drawer and on /admin/mailer; the prop contract is unchanged.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MailCheck,
  Eye,
  Check,
  X,
  Minus,
  Plus,
  Inbox,
  TriangleAlert,
  Clock,
  Reply,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MailerReport } from "@/lib/outreachMailer";

const STATUS_TONE: Record<string, "ok" | "info" | "neutral" | "danger"> = {
  sent: "ok",
  dry: "info",
  skipped: "neutral",
  error: "danger",
};
const STATUS_LABEL: Record<string, string> = {
  sent: "gesendet",
  dry: "Vorschau",
  skipped: "übersprungen",
  error: "Fehler",
};

function StatCard({ k, v, s, accent }: { k: string; v: React.ReactNode; s: string; accent?: boolean }) {
  return (
    <Card className="px-5 py-4">
      <div className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3">{k}</div>
      <div
        className="[font-family:var(--font-display)] font-extrabold text-[32px] leading-none tracking-[-0.03em] mt-2 [font-variant-numeric:tabular-nums]"
        style={{ color: accent ? "var(--accent)" : "var(--fg)" }}
      >
        {v}
      </div>
      <div className="text-[13px] text-fg-3 mt-2 font-medium">{s}</div>
    </Card>
  );
}

function CapStepper({ cap, setCap, disabled }: { cap: number; setCap: (n: number) => void; disabled: boolean }) {
  const clamp = (n: number) => Math.max(1, Math.min(300, n));
  return (
    <div>
      <div className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3 mb-2">Cap (pro Lauf)</div>
      <div className="inline-flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setCap(clamp(cap - 1))} disabled={disabled || cap <= 1} aria-label="Cap −1">
          <Minus />
        </Button>
        <input
          type="number"
          min={1}
          max={300}
          value={cap}
          disabled={disabled}
          onChange={(e) => setCap(clamp(Number(e.target.value) || 1))}
          className="w-[68px] text-center px-2.5 py-2 border border-line-strong rounded-[var(--radius-sm)] bg-surface text-fg text-sm [font-family:var(--font-mono)] [font-variant-numeric:tabular-nums] focus:border-fg focus:outline-none"
        />
        <Button variant="outline" size="icon" onClick={() => setCap(clamp(cap + 1))} disabled={disabled || cap >= 300} aria-label="Cap +1">
          <Plus />
        </Button>
      </div>
    </div>
  );
}

function CountChip({ n, tone, label }: { n: number; tone: "ok" | "info" | "neutral" | "danger"; label: string }) {
  if (!n) return null;
  return (
    <Badge tone={tone} dot>
      <span className="[font-variant-numeric:tabular-nums]">{n}</span> {label}
    </Badge>
  );
}

export default function MailerClient({
  dueMail1,
  senderEnabled,
  cronSet,
  inboundSet,
}: {
  dueMail1: number;
  senderEnabled: boolean;
  cronSet: boolean;
  inboundSet: boolean;
}) {
  const router = useRouter();
  const [cap, setCap] = useState(25);
  const [running, setRunning] = useState<"dry" | "send" | null>(null);
  const [armed, setArmed] = useState(false);
  const [report, setReport] = useState<MailerReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const willSend = Math.min(cap, dueMail1);

  async function run(dryRun: boolean) {
    setRunning(dryRun ? "dry" : "send");
    setError(null);
    setArmed(false);
    try {
      const res = await fetch("/admin/mailer/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cap, dryRun }),
      });
      const j = (await res.json()) as { ok?: boolean; report?: MailerReport; error?: string };
      if (res.ok && j.ok && j.report) {
        setReport(j.report);
        // Auto-refresh: a real send mutated the targets, so re-fetch the server
        // data (dueMail1, inbox counts) without forcing the admin to reload.
        if (!dryRun && j.report.live) router.refresh();
      } else {
        setError(j.error || "Lauf fehlgeschlagen.");
      }
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="pt-1">
      {/* Compact drawer header — leaves room for the absolute "Schließen" button. */}
      <header className="flex gap-3.5 items-start mb-5 pr-[84px]">
        <span className="inline-flex items-center justify-center size-10 shrink-0 rounded-[var(--radius-sm)] border border-line-strong bg-surface text-fg">
          <MailCheck size={20} aria-hidden />
        </span>
        <div>
          <div className="[font-family:var(--font-display)] font-extrabold text-[22px] tracking-[-0.02em] leading-tight text-fg">Welle mailen</div>
          <div className="text-[13px] text-fg-3 mt-1 leading-relaxed max-w-[42ch]">
            Mail-1 (Erstkontakt) direkt über Brevo. Erst Vorschau, dann senden. Mail-2 läuft separat im Antworten-Flow.
          </div>
        </div>
      </header>

      <div className="flex gap-2 flex-wrap mb-5">
        <Badge tone={senderEnabled ? "ok" : "neutral"} dot>
          <Send className="size-3" /> {senderEnabled ? "Sender scharf" : "Sender Test"}
        </Badge>
        <Badge tone={cronSet ? "ok" : "neutral"} dot>
          <Clock className="size-3" /> {cronSet ? "Cron aktiv" : "Cron aus"}
        </Badge>
        <Badge tone={inboundSet ? "ok" : "neutral"} dot>
          <Reply className="size-3" /> {inboundSet ? "Reply-Routing" : "Reply fehlt"}
        </Badge>
      </div>

      {!senderEnabled && (
        <div className="flex gap-2.5 items-start mb-5 px-3.5 py-3 rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--warning)_40%,var(--line))] bg-[color-mix(in_oklab,var(--warning)_10%,var(--surface))] text-[13.5px] text-fg-2">
          <TriangleAlert size={17} className="text-warning shrink-0 mt-px" aria-hidden />
          <span>
            <strong className="text-warning">Test-Modus.</strong> <code>KLAR_OUTREACH_SENDER</code> ist nicht <code>on</code>: der Senden-Button
            zeigt nur die Vorschau, verschickt aber nichts.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard k="Fällig für Mail-1" v={dueMail1} s="queued · nie gemailt · mit Email" />
        <StatCard k="Dieser Lauf" v={willSend} s={willSend < dueMail1 ? `${dueMail1 - willSend} bleiben für später` : "alle fälligen"} accent />
      </div>

      <div className="flex flex-wrap gap-4 items-end justify-between p-4 rounded-[var(--radius)] border border-line bg-surface">
        <CapStepper cap={cap} setCap={setCap} disabled={running !== null} />

        <div className="flex gap-2.5 items-center flex-wrap">
          <Button variant="ghost" onClick={() => run(true)} disabled={running !== null}>
            <Eye /> {running === "dry" ? "Vorschau läuft…" : "Vorschau"}
          </Button>
          {!armed ? (
            <Button variant="pop" onClick={() => setArmed(true)} disabled={running !== null || dueMail1 === 0}>
              <MailCheck /> {senderEnabled ? "Jetzt senden" : "Senden (Test)"}
            </Button>
          ) : (
            <span className="inline-flex gap-2 items-center flex-wrap">
              <span className="text-[12.5px] font-semibold text-fg-3">
                {senderEnabled ? `Wirklich ${willSend} ${willSend === 1 ? "Mail" : "Mails"} senden?` : "Test senden (nichts geht raus)?"}
              </span>
              <Button variant={senderEnabled ? "danger" : "default"} onClick={() => run(false)} disabled={running !== null}>
                <Check /> {running === "send" ? "Läuft…" : "Bestätigen"}
              </Button>
              <Button variant="ghost" onClick={() => setArmed(false)} disabled={running !== null}>
                <X /> Abbrechen
              </Button>
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="flex gap-2.5 items-center mt-4 px-3.5 py-3 rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--danger)_40%,var(--line))] text-danger text-[13.5px]">
          <TriangleAlert size={16} className="shrink-0" aria-hidden /> {error}
        </div>
      )}

      {report && (
        <section className="mt-7">
          <div className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fg-3 mb-3">Ergebnis</div>
          <div className="flex gap-2 flex-wrap items-center mb-3.5">
            <Badge tone={report.live ? "danger" : "info"} dot>
              {report.live ? "LIVE gesendet" : "Dry-Run"}
            </Badge>
            <CountChip n={report.counts.sent} tone="ok" label="gesendet" />
            <CountChip n={report.counts.dry} tone="info" label="Vorschau" />
            <CountChip n={report.counts.skipped} tone="neutral" label="übersprungen" />
            <CountChip n={report.counts.error} tone="danger" label="Fehler" />
          </div>

          {report.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 text-center px-6 py-9 border border-dashed border-line-strong rounded-[var(--radius)] bg-surface text-fg-3">
              <Inbox className="size-6 text-fg-4" strokeWidth={1.5} aria-hidden />
              <div className="[font-family:var(--font-body)] font-semibold text-sm text-fg-2">Keine fälligen Mail-1-Targets</div>
              <div className="text-[13px] max-w-[42ch] leading-relaxed">Starte erst eine Scrape-Welle in Outreach, dann erscheinen hier die Erstkontakte.</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Handle</TableHead>
                  <TableHead>App</TableHead>
                  <TableHead>Betreff</TableHead>
                  <TableHead>Grund</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.items.map((it, i) => (
                  <TableRow key={`${it.id}-${i}`}>
                    <TableCell>
                      <Badge tone={STATUS_TONE[it.status] ?? "neutral"} dot>
                        {STATUS_LABEL[it.status] ?? it.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">@{it.handle}</TableCell>
                    <TableCell className="text-fg-3">{it.app ?? "—"}</TableCell>
                    <TableCell className="max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap" title={it.subject}>
                      {it.subject || "—"}
                    </TableCell>
                    <TableCell className="text-fg-3">{it.reason ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      )}
    </div>
  );
}
