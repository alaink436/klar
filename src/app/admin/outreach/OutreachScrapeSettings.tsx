"use client";

// Scrape-Einstellungen card: the production backend switch + per-wave profile cap.
// Native form POST to /admin/outreach/scrape-settings (device+admin gated, 303 back).
// The wave_backend radio is the load-bearing control: 'evomi' makes "Welle starten"
// run the in-app queue+cron (TikTok via Evomi, IG via Apify); 'n8n' keeps the legacy
// webhook path. Mounted at the top of the Evomi tab in page.tsx.

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface ScrapeSettingsView {
  wave_backend: "n8n" | "evomi";
  tiktok_backend: "apify" | "selfhost";
  max_profiles_per_wave: number;
  updated_at: string | null;
}

const LABEL =
  "[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-fg-2";
const HINT = "text-[11px] text-fg-4 mt-1";

export default function OutreachScrapeSettings({ settings }: { settings: ScrapeSettingsView }) {
  const [backend, setBackend] = useState<"n8n" | "evomi">(settings.wave_backend);
  const [cap, setCap] = useState(settings.max_profiles_per_wave);

  return (
    <Card className="p-5 mb-5">
      <div className={LABEL}>Scrape-Backend</div>
      <p className={HINT}>
        Welcher Pfad eine <strong className="text-fg-2">&bdquo;Welle starten&ldquo;</strong> abarbeitet. Default{" "}
        <code>n8n</code> ändert nichts an der laufenden Pipeline.
      </p>

      <form method="POST" action="/admin/outreach/scrape-settings" className="mt-4 flex flex-col gap-4">
        {/* Backend radio */}
        <div className="flex flex-col gap-2">
          {(
            [
              {
                v: "n8n" as const,
                title: "n8n (Apify)",
                desc: "Welle feuert den n8n-Webhook. Apify-Discovery + Apify-Enrichment, wie bisher.",
              },
              {
                v: "evomi" as const,
                title: "Evomi (in-app)",
                desc: "Welle läuft in-app: Apify-Discovery → Queue → Cron reichert an (TikTok via Evomi, IG via Apify-Profil-Scraper) → Mailer. Kein n8n.",
              },
            ]
          ).map((opt) => (
            <label
              key={opt.v}
              className={`flex items-start gap-3 p-3 rounded-[var(--radius-sm)] border cursor-pointer transition ${
                backend === opt.v ? "border-fg bg-surface-2" : "border-line bg-surface hover:border-line-strong"
              }`}
            >
              <input
                type="radio"
                name="wave_backend"
                value={opt.v}
                checked={backend === opt.v}
                onChange={() => setBackend(opt.v)}
                className="mt-1"
              />
              <span>
                <span className="text-[13px] font-semibold text-fg">{opt.title}</span>
                <span className="block text-[11.5px] text-fg-3 mt-0.5">{opt.desc}</span>
              </span>
            </label>
          ))}
        </div>

        {/* Keep the current TikTok-backend value (apify) so the upsert doesn't reset it. */}
        <input type="hidden" name="tiktok_backend" value={settings.tiktok_backend} />

        {/* Max profiles per wave */}
        <label className="flex items-center gap-3 text-[13px]">
          <span className="text-fg-2 font-semibold w-44">Max Profile / Welle</span>
          <input
            type="number"
            name="max_profiles_per_wave"
            min={5}
            max={200}
            value={cap}
            onChange={(e) => setCap(Math.min(200, Math.max(5, Number(e.target.value) || 5)))}
            className="w-24 px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-line bg-surface text-fg [font-family:var(--font-mono)]"
          />
          <span className="text-fg-4 text-[11px]">Obergrenze für Enrichment-Volumen (Evomi-Credits / Apify-Items), 5–200</span>
        </label>

        <div className="flex items-center gap-3 mt-1">
          <Button type="submit" variant="pop">
            Speichern
          </Button>
          {settings.updated_at && (
            <span className="text-[11px] text-fg-4 [font-family:var(--font-mono)]">
              zuletzt {new Date(settings.updated_at).toLocaleString("de-CH")}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
