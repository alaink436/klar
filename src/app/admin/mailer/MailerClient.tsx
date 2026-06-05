"use client";

// Klar Control · Mailer (client). Drives the in-app outreach mailer for Mail-1
// (cold first contact) only: dry-run preview + env-gated real send via
// /admin/mailer/run. Mail-2 / detail mail is sent on-demand from the reply flow.
//
// Built from the shared admin design system (_shared.ts): .tbadge status badges,
// .card stat tiles, .card-table result rows, .btn.pop primary CTA, .empty state,
// with @remixicon/react glyphs. Renders inside the 600px inbox "Welle mailen"
// drawer, so the header is compact (no giant page <h1>).

import { useState } from "react";
import {
  RiMailSendLine,
  RiEyeLine,
  RiCheckLine,
  RiCloseLine,
  RiSubtractLine,
  RiAddLine,
  RiInboxArchiveLine,
  RiAlertLine,
  RiSendPlaneLine,
  RiTimeLine,
  RiReplyLine,
} from "@remixicon/react";
import type { MailerReport } from "@/lib/outreachMailer";

const STATUS_TONE: Record<string, string> = {
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

function StatusBadge({ status }: { status: string }) {
  return <span className={`tbadge ${STATUS_TONE[status] ?? "neutral"}`}>{STATUS_LABEL[status] ?? status}</span>;
}

/** A config indicator pill — semantic dot via .tbadge tone + a leading glyph. */
function ConfigBadge({ on, onLabel, offLabel, Icon }: {
  on: boolean;
  onLabel: string;
  offLabel: string;
  Icon: typeof RiSendPlaneLine;
}) {
  return (
    <span className={`tbadge ${on ? "ok" : "neutral"}`} style={{ paddingLeft: 8 }}>
      <Icon size={12} style={{ margin: "0 -1px 0 1px" }} aria-hidden />
      {on ? onLabel : offLabel}
    </span>
  );
}

function StatCard({ k, v, s, accent }: { k: string; v: React.ReactNode; s: string; accent?: boolean }) {
  return (
    <div className="card">
      <div className="k">{k}</div>
      <div className="v" style={accent ? { color: "var(--accent, var(--fg))" } : undefined}>{v}</div>
      <div className="s">{s}</div>
    </div>
  );
}

function CapStepper({ cap, setCap, disabled }: { cap: number; setCap: (n: number) => void; disabled: boolean }) {
  const clamp = (n: number) => Math.max(1, Math.min(300, n));
  return (
    <label style={{ display: "block" }}>
      <div className="k" style={{ marginBottom: 7 }}>Cap (pro Lauf)</div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <button type="button" className="tbtn" onClick={() => setCap(clamp(cap - 1))} disabled={disabled || cap <= 1} aria-label="Cap −1">
          <RiSubtractLine />
        </button>
        <input
          type="number"
          min={1}
          max={300}
          value={cap}
          disabled={disabled}
          onChange={(e) => setCap(clamp(Number(e.target.value) || 1))}
          style={{
            width: 68, padding: "7px 10px", textAlign: "center",
            border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)",
            background: "var(--surface)", color: "var(--fg)", fontSize: 14,
            fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
          }}
        />
        <button type="button" className="tbtn" onClick={() => setCap(clamp(cap + 1))} disabled={disabled || cap >= 300} aria-label="Cap +1">
          <RiAddLine />
        </button>
      </div>
    </label>
  );
}

function CountChip({ n, tone, label }: { n: number; tone: string; label: string }) {
  if (!n) return null;
  return (
    <span className={`tbadge ${tone}`}>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{n}</span> {label}
    </span>
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
      if (res.ok && j.ok && j.report) setReport(j.report);
      else setError(j.error || "Lauf fehlgeschlagen.");
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <div style={{ paddingTop: 4 }}>
      {/* Compact drawer header — leaves room for the absolute "Schließen" button. */}
      <header style={{ display: "flex", gap: 13, alignItems: "flex-start", paddingRight: 84, marginBottom: 20 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 40, height: 40, flexShrink: 0, borderRadius: "var(--radius-sm)",
          border: "1px solid var(--line-strong)", background: "var(--surface)", color: "var(--fg)",
        }}>
          <RiMailSendLine size={20} aria-hidden />
        </span>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, letterSpacing: "-.02em", lineHeight: 1.1, color: "var(--fg)" }}>
            Welle mailen
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5, maxWidth: "42ch" }}>
            Mail-1 (Erstkontakt) direkt über Brevo. Erst Vorschau, dann senden. Mail-2 läuft separat im Antworten-Flow.
          </div>
        </div>
      </header>

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 20 }}>
        <ConfigBadge on={senderEnabled} onLabel="Sender scharf" offLabel="Sender Test" Icon={RiSendPlaneLine} />
        <ConfigBadge on={cronSet} onLabel="Cron aktiv" offLabel="Cron aus" Icon={RiTimeLine} />
        <ConfigBadge on={inboundSet} onLabel="Reply-Routing" offLabel="Reply fehlt" Icon={RiReplyLine} />
      </div>

      {!senderEnabled && (
        <div className="flash" style={{ borderColor: "var(--warning)", display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 20 }}>
          <RiAlertLine size={17} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} aria-hidden />
          <span>
            <strong style={{ color: "var(--warning)" }}>Test-Modus.</strong>{" "}
            <code>KLAR_OUTREACH_SENDER</code> ist nicht <code>on</code>: der Senden-Button zeigt nur die Vorschau, verschickt aber nichts.
          </span>
        </div>
      )}

      <div className="cards" style={{ gridTemplateColumns: "repeat(2,1fr)", marginBottom: 20 }}>
        <StatCard k="Fällig für Mail-1" v={dueMail1} s="queued · nie gemailt · mit Email" />
        <StatCard k="Dieser Lauf" v={willSend} s={willSend < dueMail1 ? `${dueMail1 - willSend} bleiben für später` : "alle fälligen"} accent />
      </div>

      <div className="batch" style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-end", justifyContent: "space-between" }}>
        <CapStepper cap={cap} setCap={setCap} disabled={running !== null} />

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={() => run(true)} disabled={running !== null}>
            <RiEyeLine /> {running === "dry" ? "Vorschau läuft…" : "Vorschau"}
          </button>
          {!armed ? (
            <button className="btn pop" onClick={() => setArmed(true)} disabled={running !== null || dueMail1 === 0}>
              <RiMailSendLine /> {senderEnabled ? "Jetzt senden" : "Senden (Test)"}
            </button>
          ) : (
            <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>
                {senderEnabled
                  ? `Wirklich ${willSend} ${willSend === 1 ? "Mail" : "Mails"} senden?`
                  : "Test senden (nichts geht raus)?"}
              </span>
              <button
                className="btn"
                onClick={() => run(false)}
                disabled={running !== null}
                style={senderEnabled ? { background: "var(--danger)", borderColor: "var(--danger)", color: "#fff" } : undefined}
              >
                <RiCheckLine /> {running === "send" ? "Läuft…" : "Bestätigen"}
              </button>
              <button className="btn ghost" onClick={() => setArmed(false)} disabled={running !== null}>
                <RiCloseLine /> Abbrechen
              </button>
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="flash" style={{ marginTop: 16, borderColor: "var(--danger)", color: "var(--danger)", display: "flex", gap: 9, alignItems: "center" }}>
          <RiAlertLine size={16} style={{ flexShrink: 0 }} aria-hidden /> {error}
        </div>
      )}

      {report && (
        <section style={{ marginTop: 26 }}>
          <h2>Ergebnis</h2>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", margin: "0 0 14px" }}>
            <span className={`pill${report.live ? " live" : ""}`}>{report.live ? "LIVE gesendet" : "Dry-Run"}</span>
            <CountChip n={report.counts.sent} tone="ok" label="gesendet" />
            <CountChip n={report.counts.dry} tone="info" label="Vorschau" />
            <CountChip n={report.counts.skipped} tone="neutral" label="übersprungen" />
            <CountChip n={report.counts.error} tone="danger" label="Fehler" />
          </div>

          {report.items.length === 0 ? (
            <div className="empty">
              <RiInboxArchiveLine aria-hidden />
              <div className="empty-title">Keine fälligen Mail-1-Targets</div>
              <div className="empty-sub">Starte erst eine Scrape-Welle in Outreach, dann erscheinen hier die Erstkontakte.</div>
            </div>
          ) : (
            <table className="card-table">
              <thead>
                <tr><th>Status</th><th>Handle</th><th>App</th><th>Betreff</th><th>Grund</th></tr>
              </thead>
              <tbody>
                {report.items.map((it, i) => (
                  <tr key={`${it.id}-${i}`}>
                    <td><StatusBadge status={it.status} /></td>
                    <td style={{ fontWeight: 600 }}>@{it.handle}</td>
                    <td className="muted">{it.app ?? "—"}</td>
                    <td style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.subject}>{it.subject || "—"}</td>
                    <td className="muted">{it.reason ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
