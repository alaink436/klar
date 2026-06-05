"use client";

// Klar Control · Mailer (client). Drives the in-app outreach mailer for Mail-1
// (cold first contact) only: dry-run preview + env-gated real send via
// /admin/mailer/run. Mail-2 / detail mail is sent on-demand from the reply flow.

import { useState } from "react";
import type { MailerReport } from "@/lib/outreachMailer";

const STATUS_COLOR: Record<string, string> = {
  sent: "var(--success)",
  dry: "var(--info)",
  skipped: "var(--fg-3)",
  error: "var(--danger)",
};
const STATUS_LABEL: Record<string, string> = {
  sent: "gesendet",
  dry: "Vorschau",
  skipped: "übersprungen",
  error: "Fehler",
};

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
  const [cap, setCap] = useState(40);
  const [running, setRunning] = useState<"dry" | "send" | null>(null);
  const [armed, setArmed] = useState(false);
  const [report, setReport] = useState<MailerReport | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <>
      <h1>Mailer</h1>
      <p className="sub">
        Mail-1 (Erstkontakt) direkt aus der App über Brevo, ohne n8n. Erst Vorschau, dann senden.
        Der Cron nutzt dieselbe Engine. Mail-2 (Detail-Mail für Interessenten) läuft separat on-demand im Antworten-Flow.
      </p>

      {!senderEnabled && (
        <div className="flash" style={{ borderColor: "var(--warning)", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <strong style={{ color: "var(--warning)" }}>Test-Modus.</strong>
          <span>
            <code>KLAR_OUTREACH_SENDER</code> ist nicht auf <code>on</code>. „Jetzt senden“ zeigt nur, was rausginge,
            verschickt aber nichts. Zum Scharfschalten env in Vercel setzen und n8n-Mailversand abschalten (sonst Doppel-Mails).
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 18px" }}>
        <span className="pill" style={{ borderColor: senderEnabled ? "var(--success)" : "var(--line-strong)" }}>
          Sender: {senderEnabled ? "scharf" : "Test"}
        </span>
        <span className="pill" style={{ borderColor: cronSet ? "var(--success)" : "var(--line-strong)" }}>
          Cron: {cronSet ? "aktiv (täglich 09:00 UTC)" : "CRON_SECRET fehlt"}
        </span>
        <span className="pill" style={{ borderColor: inboundSet ? "var(--success)" : "var(--line-strong)" }}>
          Reply-Routing: {inboundSet ? "gesetzt" : "KLAR_INBOUND_DOMAIN fehlt"}
        </span>
      </div>

      <div className="cards" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="k">Fällig für Mail-1</div>
          <div className="v">{dueMail1}</div>
          <div className="s">queued, noch nie gemailt, mit Email</div>
        </div>
      </div>

      <div className="batch" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
        <label style={{ fontSize: 12, color: "var(--fg-3)" }}>
          <div className="k" style={{ marginBottom: 6 }}>Cap (pro Lauf)</div>
          <input
            type="number"
            min={1}
            max={300}
            value={cap}
            onChange={(e) => setCap(Number(e.target.value) || 40)}
            style={{ width: 72, padding: "7px 10px", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--fg)", fontSize: 13, fontFamily: "var(--font-mono)" }}
          />
        </label>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={() => run(true)} disabled={running !== null}>
            {running === "dry" ? "Vorschau läuft…" : "Vorschau (Dry-Run)"}
          </button>
          {!armed ? (
            <button className="btn" onClick={() => setArmed(true)} disabled={running !== null}>
              {senderEnabled ? "Jetzt senden" : "Senden (Test)"}
            </button>
          ) : (
            <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
              <span className="muted" style={{ fontSize: 12 }}>
                {senderEnabled ? `Wirklich an bis zu ${cap} senden?` : "Test senden (nichts geht raus)?"}
              </span>
              <button className="btn" onClick={() => run(false)} disabled={running !== null} style={senderEnabled ? { background: "var(--danger)", borderColor: "var(--danger)", color: "#fff" } : undefined}>
                {running === "send" ? "Läuft…" : "Bestätigen"}
              </button>
              <button className="btn ghost" onClick={() => setArmed(false)}>Abbrechen</button>
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="flash" style={{ marginTop: 16, borderColor: "var(--danger)", color: "var(--danger)" }}>{error}</div>
      )}

      {report && (
        <>
          <h2>
            Ergebnis{" "}
            <span className="muted" style={{ fontSize: 11, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
              {report.live ? "LIVE gesendet" : "Dry-Run (nichts gesendet)"} · {report.counts.sent} gesendet · {report.counts.dry} Vorschau · {report.counts.skipped} übersprungen · {report.counts.error} Fehler
            </span>
          </h2>
          {report.items.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Keine fälligen Mail-1-Targets (keine aktive Scrape-Welle).</p>
          ) : (
            <table>
              <thead>
                <tr><th>Status</th><th>Handle</th><th>App</th><th>Betreff</th><th>Grund</th></tr>
              </thead>
              <tbody>
                {report.items.map((it, i) => (
                  <tr key={`${it.id}-${i}`}>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLOR[it.status] }} />
                        {STATUS_LABEL[it.status]}
                      </span>
                    </td>
                    <td>@{it.handle}</td>
                    <td>{it.app ?? "—"}</td>
                    <td style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.subject}>{it.subject || "—"}</td>
                    <td className="muted">{it.reason ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  );
}
