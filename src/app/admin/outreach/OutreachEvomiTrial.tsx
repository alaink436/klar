"use client";

// Evomi test bench (client). Runs a dry-run / commit / delete against
// /admin/outreach/wave-evomi and renders the report so the operator can SEE what
// happened: a result headline, the funnel (discovered -> dedup -> enriched -> with
// email), where the emails came from (direct/bio/linktree/website), whether the
// residential proxy was used, and the would-be rows. Fully responsive (stacks on
// narrow screens, the row table scrolls).

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface OutreachEvomiTrialProps {
  appsLive: { slug: string; name: string }[];
}

type Platform = "instagram" | "tiktok";
type Bucket = "nano" | "micro" | "mid" | "macro";
type EmailSource = "direct" | "bio" | "aggregator" | "website";

interface ReportRow {
  handle: string;
  platform: Platform;
  follower_estimate: number | null;
  niche: string | null;
  contact_email: string | null;
  notes: string | null;
  mail_status: string | null;
  email_source?: EmailSource;
}

interface WaveReport {
  ok: boolean;
  commit: boolean;
  app: string;
  niche: string | null;
  followerRange: [number, number];
  maxProfiles: number;
  discovered: number;
  deduped: number;
  enriched: number;
  withEmail: number;
  inserted: number;
  rows: ReportRow[];
  perStageCounts: {
    discovered: number;
    dedupExistingDropped: number;
    suppressedDropped: number;
    cappedTo: number;
    enriched: number;
    withEmail: number;
    inSizeBucket: number;
    final: number;
  };
  emailSources: { direct: number; bio: number; aggregator: number; website: number };
  proxyUsed: boolean;
  durationMs: number;
  partial: boolean;
  error?: string;
}

const BUCKETS: Bucket[] = ["nano", "micro", "mid", "macro"];
const BUCKET_LABEL: Record<Bucket, string> = {
  nano: "Nano <10k",
  micro: "Micro 10–50k",
  mid: "Mid 50–500k",
  macro: "Macro 500k+",
};
const SOURCE_LABEL: Record<EmailSource, string> = {
  direct: "Profil-Email",
  bio: "aus Bio",
  aggregator: "Linktree & Co",
  website: "Website/Impressum",
};

const LABEL =
  "[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-fg-2";
const HINT = "text-[11px] text-fg-4 mt-1";
const FIELD =
  "px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-line bg-surface text-fg text-[13px]";

function num(n: number): string {
  return n.toLocaleString("de-CH");
}

// One step in the funnel display.
function FunnelStep({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="flex-1 min-w-[64px] text-center">
      <div
        className={`[font-family:var(--font-display)] font-extrabold text-[22px] leading-none [font-variant-numeric:tabular-nums] ${accent ? "text-accent" : "text-fg"}`}
      >
        {num(value)}
      </div>
      <div className="[font-family:var(--font-mono)] text-[9px] uppercase tracking-[0.08em] text-fg-4 mt-1.5">{label}</div>
    </div>
  );
}

export default function OutreachEvomiTrial({ appsLive }: OutreachEvomiTrialProps) {
  const [app, setApp] = useState(appsLive[0]?.slug ?? "");
  const [platforms, setPlatforms] = useState<Platform[]>(["instagram", "tiktok"]);
  const [buckets, setBuckets] = useState<Bucket[]>(["micro"]);
  const [count, setCount] = useState(5);
  const [niche, setNiche] = useState("");
  const [busy, setBusy] = useState<null | "dry" | "commit" | "delete">(null);
  const [report, setReport] = useState<WaveReport | null>(null);
  const [deleted, setDeleted] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function togglePlatform(p: Platform) {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }
  function toggleBucket(b: Bucket) {
    setBuckets((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]));
  }

  async function run(commit: boolean) {
    setBusy(commit ? "commit" : "dry");
    setErr(null);
    setDeleted(null);
    try {
      const res = await fetch("/admin/outreach/wave-evomi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app, platforms, size_buckets: buckets, count, niche: niche.trim() || null, language: "de", commit }),
      });
      const j = (await res.json()) as WaveReport & { error?: string };
      if (!res.ok && !j.rows) {
        setErr(j.error ?? `HTTP ${res.status}`);
        setReport(null);
      } else {
        setReport(j);
        if (j.error) setErr(j.error);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setReport(null);
    } finally {
      setBusy(null);
    }
  }

  async function removeTrial() {
    setBusy("delete");
    setErr(null);
    try {
      const res = await fetch("/admin/outreach/wave-evomi", { method: "DELETE" });
      const j = (await res.json()) as { ok: boolean; deleted?: number; error?: string };
      if (!res.ok || !j.ok) setErr(j.error ?? `HTTP ${res.status}`);
      else {
        setDeleted(j.deleted ?? 0);
        setReport(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const c = report?.perStageCounts;
  const disabled = busy != null || !app || platforms.length === 0 || buckets.length === 0;
  const sources = report ? (Object.keys(report.emailSources) as EmailSource[]).filter((k) => report.emailSources[k] > 0) : [];

  return (
    <Card className="p-4 sm:p-5">
      <div className={LABEL}>Evomi-Scrape testen (n8n-frei)</div>
      <p className={HINT}>
        <strong className="text-fg-2">Dry-Run</strong> zeigt, was eine Welle finden würde, ohne etwas zu
        speichern. <strong className="text-fg-2">Commit</strong> legt die Funde als markierte Test-Targets an
        (werden nie automatisch gemailt). <strong className="text-fg-2">Löschen</strong> entfernt sie wieder.
      </p>

      {/* ── Controls ── */}
      <div className="mt-4 flex flex-col gap-4 text-[13px]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <label className="flex items-center gap-2">
            <span className="text-fg-2 font-semibold w-16 shrink-0">App</span>
            <select value={app} onChange={(e) => setApp(e.target.value)} className={`flex-1 sm:flex-none ${FIELD}`}>
              {appsLive.map((a) => (
                <option key={a.slug} value={a.slug}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-fg-2 font-semibold w-16 shrink-0 sm:w-auto">Count</span>
            <input
              type="number" min={1} max={5} value={count}
              onChange={(e) => setCount(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
              className={`w-20 [font-family:var(--font-mono)] ${FIELD}`}
            />
            <span className="text-fg-4 text-[11px]">max 5</span>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <span className="text-fg-2 font-semibold w-16 shrink-0">Plattform</span>
          <div className="flex gap-4">
            {(["instagram", "tiktok"] as Platform[]).map((p) => (
              <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={platforms.includes(p)} onChange={() => togglePlatform(p)} />
                <span className="capitalize">{p}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-fg-2 font-semibold w-16 shrink-0">Größe</span>
          <div className="flex gap-2 flex-wrap">
            {BUCKETS.map((b) => {
              const on = buckets.includes(b);
              return (
                <button
                  key={b} type="button" onClick={() => toggleBucket(b)}
                  className={`px-2.5 py-1 rounded-full border text-[11px] [font-family:var(--font-mono)] uppercase tracking-[0.06em] transition ${on ? "bg-fg text-accent-fg border-fg" : "bg-surface text-fg-3 border-line-strong hover:text-fg"}`}
                >
                  {BUCKET_LABEL[b]}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-fg-2 font-semibold w-16 shrink-0">Niche</span>
          <input
            type="text" value={niche} onChange={(e) => setNiche(e.target.value)}
            placeholder="leer → kuratierter Hashtag-Pool der App" maxLength={80}
            className={`flex-1 ${FIELD}`}
          />
        </label>
      </div>

      {/* ── Actions ── */}
      <div className="mt-5 flex items-center gap-2.5 flex-wrap">
        <Button type="button" disabled={disabled} onClick={() => run(false)}>{busy === "dry" ? "läuft …" : "Dry-Run"}</Button>
        <Button type="button" variant="pop" disabled={disabled} onClick={() => run(true)}>{busy === "commit" ? "läuft …" : "Commit"}</Button>
        <Button type="button" variant="danger" disabled={busy != null} onClick={removeTrial}>{busy === "delete" ? "lösche …" : "Trial-Targets löschen"}</Button>
      </div>

      {err && <p className="text-[12px] text-danger mt-3">Fehler: {err}</p>}
      {deleted != null && <p className="text-[12px] text-fg-2 mt-3">{deleted} Trial-Rows gelöscht.</p>}

      {/* ── Result ── */}
      {report && c && (
        <div className="mt-5 flex flex-col gap-4">
          {/* Headline: did it work? */}
          <div
            className="rounded-[var(--radius)] border p-3.5 flex items-center gap-3 flex-wrap"
            style={{
              borderColor: report.withEmail > 0 ? "color-mix(in oklab, var(--success) 40%, var(--line))" : "var(--line)",
              background: report.withEmail > 0 ? "color-mix(in oklab, var(--success) 8%, transparent)" : "var(--surface-2)",
            }}
          >
            <span className="text-[22px] leading-none">{report.withEmail > 0 ? "✅" : "🔍"}</span>
            <div className="flex-1 min-w-[200px]">
              <div className="font-semibold text-[14px] text-fg">
                {report.withEmail > 0
                  ? `${report.withEmail} mailbare${report.withEmail === 1 ? "s Target" : " Targets"} gefunden`
                  : "Keine mailbaren Targets"}
                <span className="text-fg-4 font-normal"> · {report.commit ? `${report.inserted} gespeichert` : "Dry-Run, nichts gespeichert"}</span>
              </div>
              <div className="text-[11.5px] text-fg-3 mt-0.5">
                {report.withEmail > 0
                  ? "Diese Profile haben eine auffindbare E-Mail und würden in die Pipeline gehen."
                  : "Profile gefunden, aber ohne auffindbare E-Mail. Größeren Count oder andere Niche probieren."}
              </div>
            </div>
            <span className="[font-family:var(--font-mono)] text-[10px] text-fg-4">{(report.durationMs / 1000).toFixed(1)}s{report.partial ? " · partial" : ""}</span>
          </div>

          {/* Funnel: discovered -> usable -> enriched -> with email */}
          <div className="rounded-[var(--radius)] border border-line p-3.5">
            <div className="[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.1em] text-fg-4 mb-3">Trichter</div>
            <div className="flex items-center gap-1">
              <FunnelStep value={c.discovered} label="gefunden" />
              <span className="text-fg-4 text-[14px]">→</span>
              <FunnelStep value={c.cappedTo} label="geprüft" />
              <span className="text-fg-4 text-[14px]">→</span>
              <FunnelStep value={c.enriched} label="angereichert" />
              <span className="text-fg-4 text-[14px]">→</span>
              <FunnelStep value={report.withEmail} label="mit E-Mail" accent />
            </div>
            {(c.dedupExistingDropped > 0 || c.suppressedDropped > 0) && (
              <div className="[font-family:var(--font-mono)] text-[10px] text-fg-4 mt-2.5 text-center">
                {c.dedupExistingDropped > 0 && `${c.dedupExistingDropped} Duplikate übersprungen`}
                {c.dedupExistingDropped > 0 && c.suppressedDropped > 0 && " · "}
                {c.suppressedDropped > 0 && `${c.suppressedDropped} gesperrt`}
              </div>
            )}
          </div>

          {/* What was used + where emails came from */}
          <div className="flex flex-wrap gap-2 items-center text-[11px]">
            <span className="[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.1em] text-fg-4">Benutzt:</span>
            <span className="px-2 py-1 rounded-full bg-surface-2 border border-line text-fg-3">Apify Discovery</span>
            <span className="px-2 py-1 rounded-full bg-surface-2 border border-line text-fg-3">Evomi Enrichment</span>
            <span
              className="px-2 py-1 rounded-full border"
              style={report.proxyUsed
                ? { background: "color-mix(in oklab, var(--success) 12%, transparent)", borderColor: "color-mix(in oklab, var(--success) 40%, var(--line))", color: "var(--fg)" }
                : { background: "var(--surface-2)", borderColor: "var(--line)", color: "var(--fg-4)" }}
            >
              {report.proxyUsed ? "✓ Residential-Proxy" : "Proxy aus (direkt)"}
            </span>
            {sources.length > 0 && (
              <>
                <span className="[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.1em] text-fg-4 ml-1">E-Mail-Quelle:</span>
                {sources.map((s) => (
                  <span key={s} className="px-2 py-1 rounded-full bg-surface-2 border border-line text-fg-2">
                    {SOURCE_LABEL[s]} <strong>{report.emailSources[s]}</strong>
                  </span>
                ))}
              </>
            )}
          </div>

          {/* Rows */}
          {report.rows.length > 0 ? (
            <div className="overflow-x-auto border border-line rounded-[var(--radius)]">
              <table className="w-full text-[12px] min-w-[460px]">
                <thead>
                  <tr className="text-left [font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.1em] text-fg-4">
                    <th className="px-3 py-2">Handle</th>
                    <th className="px-3 py-2">Plat.</th>
                    <th className="px-3 py-2 text-right">Follower</th>
                    <th className="px-3 py-2">E-Mail</th>
                    <th className="px-3 py-2">Quelle</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r, i) => (
                    <tr key={`${r.platform}:${r.handle}:${i}`} className="border-t border-line">
                      <td className="px-3 py-2 [font-family:var(--font-mono)]">{r.handle}</td>
                      <td className="px-3 py-2">{r.platform === "instagram" ? "IG" : "TT"}</td>
                      <td className="px-3 py-2 text-right [font-family:var(--font-mono)]">{r.follower_estimate != null ? num(r.follower_estimate) : "—"}</td>
                      <td className="px-3 py-2 [font-family:var(--font-mono)] break-all">{r.contact_email ?? "—"}</td>
                      <td className="px-3 py-2 text-fg-3 whitespace-nowrap">{r.email_source ? SOURCE_LABEL[r.email_source] : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[12px] text-fg-3">Keine Rows (nichts überlebte Filter/Enrichment).</p>
          )}
        </div>
      )}
    </Card>
  );
}
