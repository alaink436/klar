// Scrape-Einstellungen tab: the admin surface for scrape cost controls + the
// self-host/proxy option. One native <form> POSTing to
// /admin/outreach/scrape-settings (no client state, same pattern as
// OutreachAddForm/OutreachSuppressions). Instagram self-host is rendered
// disabled (empirical proxy test: IG residential -> 429); the POST route also
// forces it to apify server-side.
//
// Type-only imports of the server-side settings/probe types are erased at
// compile, so this client component never pulls the "server-only" modules in.

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ScrapeSettings } from "../../../lib/scrapeSettings";
import type { SelfhostProbe } from "../../../lib/selfhostProbe";

export interface ScrapeSettingsData {
  settings: ScrapeSettings;
  selfhost: SelfhostProbe;
}

const LABEL =
  "[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-fg-2";
const HINT = "text-[11px] text-fg-4 mt-1";
const FIELD =
  "px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-line bg-surface text-fg text-[13px]";

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ background: ok ? "#22c55e" : "#9ca3af" }}
    />
  );
}

export default function OutreachScrapeSettings({ data }: { data: ScrapeSettingsData }) {
  const { settings: s, selfhost: sh } = data;
  return (
    <form method="POST" action="/admin/outreach/scrape-settings" className="flex flex-col gap-4 mt-2 max-w-[760px]">
      <input type="hidden" name="tab" value="scrape" />

      {/* Backend per platform */}
      <Card className="p-5">
        <div className={LABEL}>Scrape-Backend pro Plattform</div>
        <p className={HINT}>Welche Quelle pro Plattform Profile scrapt. Self-Host nutzt den VPS-Dienst + Residential-Proxy.</p>
        <div className="mt-4 flex flex-col gap-3 text-[13px]">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="w-24 text-fg-2 font-semibold">TikTok</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="tiktok_backend" value="apify" defaultChecked={s.tiktok_backend === "apify"} />
              <span>Apify <span className="text-fg-4">(apidojo, ~$0.30/1k)</span></span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="tiktok_backend" value="selfhost" defaultChecked={s.tiktok_backend === "selfhost"} />
              <span>Self-Host <span className="text-fg-4">(VPS + Proxy)</span></span>
            </label>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="w-24 text-fg-2 font-semibold">Instagram</span>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="instagram_backend" value="apify" defaultChecked readOnly />
              <span>Apify <span className="text-fg-4">(offiziell, ~$1.10)</span></span>
            </label>
            <label className="flex items-center gap-1.5 cursor-not-allowed opacity-50">
              <input type="radio" name="instagram_backend" value="selfhost" disabled />
              <span>Self-Host</span>
            </label>
            <span className="text-[11px] text-warning">⚠ IG blockt Residential (429), Apify bleibt Pflicht</span>
          </div>
        </div>
      </Card>

      {/* Wave limit */}
      <Card className="p-5">
        <div className={LABEL}>Wave-Limit</div>
        <div className="mt-3 flex items-center gap-3">
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
        </div>
        <p className={HINT}>Harte Obergrenze. Wave-Starter und n8n clampen die gescrapte Profilanzahl hierauf (dedup-then-cap).</p>
      </Card>

      {/* Self-host / proxy status */}
      <Card className="p-5">
        <div className={LABEL}>Self-Host / Proxy Status</div>
        <div className="mt-3 flex items-center gap-2 text-[13px] flex-wrap">
          <Dot ok={sh.reachable} />
          <span className="text-fg-2">{sh.reachable ? "erreichbar" : "offline"}</span>
          {sh.latencyMs != null && (
            <span className="text-fg-4 [font-family:var(--font-mono)] text-[11px]">{sh.latencyMs}ms</span>
          )}
          {sh.version && (
            <span className="text-fg-4 [font-family:var(--font-mono)] text-[11px]">v{sh.version}</span>
          )}
          {sh.gbUsed != null && (
            <span className="text-fg-4 [font-family:var(--font-mono)] text-[11px]">
              {sh.gbUsed.toFixed(2)} GB{sh.estCostUsd != null ? ` (~$${sh.estCostUsd.toFixed(2)})` : ""}
            </span>
          )}
        </div>
        {sh.note && <p className="text-[11px] text-warning mt-1">{sh.note}</p>}
        <div className="mt-4 flex items-center gap-6 flex-wrap text-[13px]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="selfhost_enabled" defaultChecked={s.selfhost_enabled} />
            <span className="text-fg-2">Self-Host aktiviert</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-fg-2">Proxy-Anbieter</span>
            <select name="proxy_provider" defaultValue={s.proxy_provider} className={FIELD}>
              <option value="none">— keiner —</option>
              <option value="iproyal">IPRoyal ($1.75/GB)</option>
              <option value="dataimpulse">DataImpulse ($1/GB)</option>
            </select>
          </label>
        </div>
        <p className={HINT}>Proxy-Zugangsdaten + Service-URL liegen als Env-Vars beim VPS-Dienst, nicht hier.</p>
      </Card>

      <div className="flex items-center gap-4 flex-wrap">
        <Button type="submit">Speichern</Button>
        <Link href="/admin/outreach?tab=abrechnung" className="text-[12px] text-fg-3 hover:text-fg underline">
          → volle Abrechnung (Apify-Spend)
        </Link>
        {s.updated_at && (
          <span className="text-[11px] text-fg-4">
            zuletzt geändert {new Date(s.updated_at).toLocaleString("de-CH")}
          </span>
        )}
      </div>
    </form>
  );
}
