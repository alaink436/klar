// Scrape-Einstellungen tab: TWO clearly-separated scrape methods, nothing else.
//   1 · n8n (Apify-Pipeline)        — the current LIVE approach; waves start in
//        the Pipeline tab. The only persisted setting (per-wave profile cap) is
//        saved here via the native form POST to /admin/outreach/scrape-settings.
//   2 · Proxy-API-Scrape (Evomi)    — the new n8n-free in-app approach, rendered
//        by <OutreachEvomiTrial> (Dry-Run / Commit / cleanup).
// The old per-platform backend radios + self-host/proxy status block were removed:
// Evomi replaces the self-host/DataImpulse idea, so those controls were noise.

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import OutreachEvomiTrial from "./OutreachEvomiTrial";
import type { ScrapeSettings } from "../../../lib/scrapeSettings";

export interface ScrapeSettingsData {
  settings: ScrapeSettings;
}

const LABEL =
  "[font-family:var(--font-mono)] text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-2";
const HINT = "text-[12px] text-fg-4 mt-1.5 max-w-[70ch]";
const FIELD =
  "px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-line bg-surface text-fg text-[13px]";

export default function OutreachScrapeSettings({
  data,
  appsLive,
}: {
  data: ScrapeSettingsData;
  appsLive: { slug: string; name: string }[];
}) {
  const s = data.settings;
  return (
    <div className="flex flex-col gap-4 mt-2 max-w-[820px]">
      <p className="text-[12.5px] text-fg-3 max-w-[80ch]">
        Es gibt zwei Wege, Influencer zu scrapen. <strong className="text-fg-2">n8n</strong> ist die
        Pipeline, die aktuell läuft. <strong className="text-fg-2">Proxy-API-Scrape</strong> ist die
        neue, n8n-freie Variante über Evomi, die du hier ausprobieren kannst. Beide finden Kandidaten
        über Apify und filtern nach Follower-Größe und E-Mail.
      </p>

      {/* ── Methode 1 · n8n ─────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className={LABEL}>1 · n8n (Apify-Pipeline)</div>
          <span className="[font-family:var(--font-mono)] text-[9px] px-2 py-0.5 rounded-full border border-line-strong text-fg-3 uppercase tracking-[0.08em]">
            aktuell live
          </span>
        </div>
        <p className={HINT}>
          Die laufende Methode. Kandidaten und Profile kommen komplett aus Apify (apidojo für TikTok,
          offizieller Hashtag-Scraper für Instagram), orchestriert von einem n8n-Workflow. Echte Wellen
          startest du oben im <strong className="text-fg-2">Pipeline</strong>-Tab.
        </p>
        <form
          method="POST"
          action="/admin/outreach/scrape-settings"
          className="mt-4 flex items-center gap-3 flex-wrap"
        >
          <input type="hidden" name="tab" value="scrape" />
          <span className="text-[13px] text-fg-2">Max. Profile pro Welle</span>
          <input
            type="number"
            name="max_profiles_per_wave"
            defaultValue={s.max_profiles_per_wave}
            min={5}
            max={200}
            step={5}
            className={`w-24 [font-family:var(--font-mono)] ${FIELD}`}
          />
          <Button type="submit">Speichern</Button>
          {s.updated_at && (
            <span className="text-[11px] text-fg-4">
              gespeichert {new Date(s.updated_at).toLocaleString("de-CH")}
            </span>
          )}
        </form>
        <p className={HINT}>
          Harte Obergrenze, auf die beide Methoden die Profilanzahl je Welle begrenzen (erst Duplikate
          raus, dann kappen).
        </p>
      </Card>

      {/* ── Methode 2 · Proxy-API-Scrape (Evomi) — the interactive card ──── */}
      <OutreachEvomiTrial appsLive={appsLive} />
    </div>
  );
}
