"use client";

// Evomi Trial card (client). Dry-Run / Commit / Trial-Targets löschen against
// /admin/outreach/wave-evomi (POST json + DELETE), rendering the returned report
// (per-stage counts + would-be rows table) into local React state so it survives
// the admin pages' 15s <meta refresh>. NOT mounted anywhere here — the orchestrator
// mounts it under the Wave-Limit card in OutreachScrapeSettings.

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface OutreachEvomiTrialProps {
  /** LIVE app slugs the trial may target (passed from the page; never trusts the
   *  client — the route re-validates against KLAR_APPS LIVE). */
  appsLive: { slug: string; name: string }[];
}

type Platform = "instagram" | "tiktok";
type Bucket = "nano" | "micro" | "mid" | "macro";

interface ReportRow {
  handle: string;
  platform: Platform;
  follower_estimate: number | null;
  niche: string | null;
  contact_email: string | null;
  notes: string | null;
  mail_status: string | null;
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

const LABEL =
  "[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-fg-2";
const HINT = "text-[11px] text-fg-4 mt-1";
const FIELD =
  "px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-line bg-surface text-fg text-[13px]";

function num(n: number): string {
  return n.toLocaleString("de-CH");
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
        body: JSON.stringify({
          app,
          platforms,
          size_buckets: buckets,
          count,
          niche: niche.trim() || null,
          language: "de",
          commit,
        }),
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
      if (!res.ok || !j.ok) {
        setErr(j.error ?? `HTTP ${res.status}`);
      } else {
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

  return (
    <Card className="p-5">
      <div className={LABEL}>2 · Proxy-API-Scrape (Evomi, n8n-frei)</div>
      <p className={HINT}>
        Die neue Variante: Kandidaten kommen aus Apify, die Anreicherung (Bio, Follower, E-Mail) läuft
        über die Evomi-Scraper-API — ganz ohne n8n und ohne eigenen Server.{" "}
        <strong className="text-fg-2">Dry-Run</strong> zeigt die gefundenen Profile, ohne etwas zu
        speichern. <strong className="text-fg-2">Commit</strong> legt sie als markierte Test-Targets an
        (werden nie automatisch gemailt). <strong className="text-fg-2">Löschen</strong> entfernt alle
        Test-Targets wieder.
      </p>

      <div className="mt-4 flex flex-col gap-4 text-[13px]">
        {/* App + count */}
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2">
            <span className="text-fg-2 font-semibold w-16">App</span>
            <select value={app} onChange={(e) => setApp(e.target.value)} className={FIELD}>
              {appsLive.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-fg-2 font-semibold">Count</span>
            <input
              type="number"
              min={1}
              max={5}
              value={count}
              onChange={(e) => setCount(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
              className={`w-20 [font-family:var(--font-mono)] ${FIELD}`}
            />
            <span className="text-fg-4 text-[11px]">max 5 (Trial)</span>
          </label>
        </div>

        {/* Platforms */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-fg-2 font-semibold w-16">Plattform</span>
          {(["instagram", "tiktok"] as Platform[]).map((p) => (
            <label key={p} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={platforms.includes(p)}
                onChange={() => togglePlatform(p)}
              />
              <span className="capitalize">{p}</span>
            </label>
          ))}
        </div>

        {/* Buckets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-fg-2 font-semibold w-16">Größe</span>
          {BUCKETS.map((b) => {
            const on = buckets.includes(b);
            return (
              <button
                key={b}
                type="button"
                onClick={() => toggleBucket(b)}
                className={`px-2.5 py-1 rounded-full border text-[11px] [font-family:var(--font-mono)] uppercase tracking-[0.06em] transition ${
                  on
                    ? "bg-fg text-accent-fg border-fg"
                    : "bg-surface text-fg-3 border-line-strong hover:text-fg"
                }`}
              >
                {BUCKET_LABEL[b]}
              </button>
            );
          })}
        </div>

        {/* Niche */}
        <label className="flex items-center gap-2">
          <span className="text-fg-2 font-semibold w-16">Niche</span>
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="leer → niche-pool / app"
            maxLength={80}
            className={`flex-1 ${FIELD}`}
          />
        </label>
      </div>

      {/* Actions */}
      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <Button type="button" disabled={disabled} onClick={() => run(false)}>
          {busy === "dry" ? "läuft …" : "Dry-Run"}
        </Button>
        <Button type="button" variant="pop" disabled={disabled} onClick={() => run(true)}>
          {busy === "commit" ? "läuft …" : "Commit"}
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={busy != null}
          onClick={removeTrial}
        >
          {busy === "delete" ? "lösche …" : "Trial-Targets löschen"}
        </Button>
      </div>

      {err && <p className="text-[12px] text-danger mt-3">Fehler: {err}</p>}
      {deleted != null && (
        <p className="text-[12px] text-fg-2 mt-3">{deleted} Trial-Rows gelöscht.</p>
      )}

      {report && c && (
        <div className="mt-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap text-[11px] [font-family:var(--font-mono)] text-fg-3">
            <span className="text-fg-2 font-semibold">{report.commit ? "COMMIT" : "DRY-RUN"}</span>
            <span>· {report.app}</span>
            <span>
              · Range {num(report.followerRange[0])}–{num(report.followerRange[1])}
            </span>
            <span>· cap {report.maxProfiles}</span>
            <span>· {report.durationMs} ms</span>
            {report.partial && <span className="text-warning">· partial</span>}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] [font-family:var(--font-mono)] text-fg-3">
            <span>discovered={c.discovered}</span>
            <span>dedup−{c.dedupExistingDropped}</span>
            <span>suppressed−{c.suppressedDropped}</span>
            <span>capped={c.cappedTo}</span>
            <span>enriched={c.enriched}</span>
            <span>withEmail={c.withEmail}</span>
            <span>inBucket={c.inSizeBucket}</span>
            <span className="text-fg font-semibold">final={c.final}</span>
            {report.commit && <span className="text-fg font-semibold">inserted={report.inserted}</span>}
          </div>

          {report.rows.length > 0 ? (
            <div className="overflow-x-auto border border-line rounded-[var(--radius)]">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left [font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.1em] text-fg-4">
                    <th className="px-3 py-2">Handle</th>
                    <th className="px-3 py-2">Plat.</th>
                    <th className="px-3 py-2 text-right">Follower</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Niche</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r, i) => (
                    <tr key={`${r.platform}:${r.handle}:${i}`} className="border-t border-line">
                      <td className="px-3 py-2 [font-family:var(--font-mono)]">{r.handle}</td>
                      <td className="px-3 py-2">{r.platform === "instagram" ? "IG" : "TT"}</td>
                      <td className="px-3 py-2 text-right [font-family:var(--font-mono)]">
                        {r.follower_estimate != null ? num(r.follower_estimate) : "—"}
                      </td>
                      <td className="px-3 py-2 [font-family:var(--font-mono)]">
                        {r.contact_email ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-fg-3">{r.niche ?? "—"}</td>
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
