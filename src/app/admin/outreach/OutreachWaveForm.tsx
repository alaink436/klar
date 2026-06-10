"use client";

// Wave starter, rebuilt on the shadcn kit as a controlled client component
// (replaces the old waveForm HTML string + the wave half of
// OutreachClientScripts). The form still POSTs natively to /admin/outreach/start
// with the exact field names that route validates: apps / platforms /
// size_buckets / languages (single) / count_per_app / niche / mail_subject /
// mail_body / cost_confirmed. The live cost estimate and template loader mirror
// the old inline JS 1:1, and the server still fail-closes on >= $2 without
// cost_confirmed=1, so the dialog here is UX, not the security boundary.

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface WaveFormApp { slug: string; name: string }
export interface WaveRegion { value: string; label: string; flag: string; market: string }
export interface WaveSize { value: string; label: string; range: string }
export type WaveBackend = "n8n" | "evomi";
export interface WaveScrapeSettings { backend: WaveBackend; maxProfiles: number }

// Cost constants mirror start/route.ts (Apify pricing 2026-05, S41 cost-cut).
const COST_CONFIRM_USD = 2.0;
const IG_ITEM_USD = 0.0023;
const TT_RUN_USD = 0.3;

// Apify is involved on BOTH paths: it is the only working profile SEARCH
// (Evomi can't search IG/TikTok — captcha/login walls). Evomi replaces the
// expensive per-profile TikTok enrichment, not the discovery.
const BACKEND_META: Record<WaveBackend, { title: string; desc: string }> = {
  n8n: {
    title: "n8n (klassisch)",
    desc: "Alles über Apify, orchestriert von n8n: Profile suchen + anreichern in einem Rutsch, Targets landen direkt in der Pipeline.",
  },
  evomi: {
    title: "Evomi (in-app)",
    desc: "Apify sucht die Profile (Hashtags/Keywords — das kann nur Apify), die Anreicherung läuft dann in-app: TikTok günstig über Evomi, Instagram über Apify. Welle startet sofort, Targets füllen sich über den 15-Minuten-Takt.",
  },
};

function Chip({
  name,
  value,
  type,
  checked,
  onChange,
  label,
  sub,
}: {
  name: string;
  value: string;
  type: "checkbox" | "radio";
  checked: boolean;
  onChange: () => void;
  label: string;
  sub?: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex flex-col items-center gap-0.5 px-3.5 py-2 border rounded-[var(--radius-sm)] cursor-pointer transition-colors text-[12px] min-w-[78px] text-center select-none",
        checked ? "border-fg bg-surface-2 text-fg" : "border-line bg-surface text-fg-3 hover:border-line-strong",
      )}
    >
      <input type={type} name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      <span className="font-semibold">{label}</span>
      {sub && <span className="[font-family:var(--font-mono)] text-[10px] text-fg-4">{sub}</span>}
    </label>
  );
}

const inputCls =
  "w-full px-3 py-2 text-sm bg-bg text-fg border border-line-strong rounded-[var(--radius-sm)] focus:border-fg focus:outline-none";

function WaveSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3 mb-2.5">
        {title} {hint && <span className="font-normal normal-case tracking-normal text-fg-4">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export default function OutreachWaveForm({
  apps: appOpts,
  regions,
  sizes: sizeOpts,
  defaultSubject,
  defaultBody,
  scrape,
}: {
  apps: WaveFormApp[];
  regions: WaveRegion[];
  sizes: WaveSize[];
  defaultSubject: string;
  defaultBody: string;
  scrape: WaveScrapeSettings;
}) {
  const [apps, setApps] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>(["tiktok", "instagram"]);
  const [sizes, setSizes] = useState<string[]>(["micro", "mid"]);
  const [region, setRegion] = useState(regions[0]?.value ?? "de");
  const [count, setCount] = useState(20);
  const [niche, setNiche] = useState("");
  const [mailOpen, setMailOpen] = useState(false);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [mailDirty, setMailDirty] = useState(false);
  const [tplStatus, setTplStatus] = useState("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Scrape backend switch lives IN the wave form (it decides what "Welle
  // starten" does) and persists immediately on click via the existing
  // scrape-settings POST — no separate tab, no extra save button.
  const [backend, setBackend] = useState<WaveBackend>(scrape.backend);
  const [maxProfiles, setMaxProfiles] = useState(scrape.maxProfiles);
  const [scrapeStatus, setScrapeStatus] = useState<"" | "saving" | "saved" | "error">("");

  async function persistScrape(next: { backend?: WaveBackend; maxProfiles?: number }) {
    const b = next.backend ?? backend;
    const m = next.maxProfiles ?? maxProfiles;
    setScrapeStatus("saving");
    try {
      const fd = new FormData();
      fd.set("wave_backend", b);
      fd.set("tiktok_backend", "apify");
      fd.set("max_profiles_per_wave", String(m));
      const res = await fetch("/admin/outreach/scrape-settings", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
        redirect: "follow", // route 303s back to the admin page; ok/redirected = saved
      });
      setScrapeStatus(res.ok || res.redirected ? "saved" : "error");
    } catch {
      setScrapeStatus("error");
    }
  }

  function pickBackend(b: WaveBackend) {
    if (b === backend) return;
    setBackend(b);
    void persistScrape({ backend: b });
  }

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  // Live cost estimate. n8n path: same arithmetic as the old calc() /
  // start/route.ts. evomi path: Apify discovery (3× over-fetch) + IG profile
  // enrichment items; TikTok enrichment runs on Evomi credits (flagged in the
  // summary line, not priced here).
  const cost = useMemo(() => {
    const nApps = apps.length;
    const ig = platforms.includes("instagram");
    const tt = platforms.includes("tiktok");
    const plats = (ig ? 1 : 0) + (tt ? 1 : 0);
    const total = nApps * plats * count; // profiles (single region)
    const smallBucket = sizes.length > 0 && sizes.every((b) => b === "nano" || b === "micro");
    if (backend === "evomi") {
      const igUsd = ig ? Math.min(Math.ceil(count * 3), 90) * IG_ITEM_USD + count * IG_ITEM_USD : 0;
      const ttUsd = tt ? 0.05 : 0; // apidojo discovery, pay-per-result
      const usd = nApps * (igUsd + ttUsd);
      return { total, usd, waves: nApps, smallBucket, evomiCredits: tt };
    }
    const scrape = smallBucket ? Math.min(Math.ceil(count * 1.8), 45) : Math.min(Math.ceil(count * 1.2), 30);
    const igUsd = ig ? scrape * IG_ITEM_USD + Math.ceil(scrape * 0.7) * IG_ITEM_USD : 0;
    const ttUsd = tt ? TT_RUN_USD : 0;
    const usd = nApps * (igUsd + ttUsd);
    return { total, usd, waves: nApps, smallBucket, evomiCredits: false };
  }, [apps, platforms, sizes, count, backend]);

  // Template loader: only when exactly one app is picked (single region already).
  // Skips while the admin has manually edited the mail (mailDirty). Status + the
  // loaded subject/body are set straight in this fetch effect, so the compiler's
  // set-state-in-effect rule is disabled for the block.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mailDirty) return;
    if (apps.length !== 1) {
      setTplStatus(apps.length === 0 ? "" : "Multi-App: jede App zieht beim Senden ihr eigenes DB-Template (ausser du bearbeitest Subject/Body hier).");
      return;
    }
    const app = apps[0];
    const ctrl = new AbortController();
    setTplStatus(`lade Template ${app}/${region}…`);
    fetch(`/admin/templates/get?app=${encodeURIComponent(app)}&language=${encodeURIComponent(region)}`, {
      credentials: "same-origin",
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((tpl: { mail1_subject?: string; mail1_body?: string } | null) => {
        if (!tpl) { setTplStatus(`⚠️ Kein Template für ${app}/${region}`); return; }
        if (tpl.mail1_subject) setSubject(tpl.mail1_subject);
        if (tpl.mail1_body) setBody(tpl.mail1_body);
        setTplStatus(`✓ Template ${app}/${region} geladen`);
      })
      .catch((e: Error) => { if (e.name !== "AbortError") setTplStatus("⚠️ Template-Load fehlgeschlagen"); });
    return () => ctrl.abort();
  }, [apps, region, mailDirty]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    setError("");
    if (apps.length === 0) { e.preventDefault(); setError("Mindestens eine App auswählen."); return; }
    if (platforms.length === 0) { e.preventDefault(); setError("Mindestens eine Plattform auswählen."); return; }
    if (sizes.length === 0) { e.preventDefault(); setError("Mindestens eine Größe auswählen."); return; }
    if (subject.trim().length < 3 || body.trim().length < 20) { e.preventDefault(); setError("Mail-Betreff/Text zu kurz."); return; }
    if (cost.usd >= COST_CONFIRM_USD && !confirmed) { e.preventDefault(); setConfirmOpen(true); }
  }

  function confirmAndSubmit() {
    setConfirmed(true);
    setConfirmOpen(false);
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  return (
    <Card className="p-6 mb-8">
      <div className="mb-1 [font-family:var(--font-display)] font-extrabold text-[22px] tracking-[-0.02em] text-fg">Welle starten</div>
      <p className="text-[13px] text-fg-3 mb-6 max-w-[80ch]">
        {BACKEND_META[backend].desc} Der Mailer kontaktiert mailbare Targets automatisch (Cap greift).
        Templates pro App lädst du automatisch (eine App + Region gewählt) oder bearbeitest sie unten.
      </p>

      <form ref={formRef} method="POST" action="/admin/outreach/start" onSubmit={onSubmit} className="flex flex-col gap-6">
        {/* Scraping backend — decides which engine "Welle starten" runs. Persists
            on click (no separate tab/save), the description above follows. */}
        <WaveSection
          title="Scraper"
          hint={
            scrapeStatus === "saving" ? "speichert …"
            : scrapeStatus === "saved" ? "✓ gespeichert"
            : scrapeStatus === "error" ? "⚠️ Speichern fehlgeschlagen"
            : "sofort gespeichert"
          }
        >
          <div className="flex flex-wrap gap-3 items-stretch">
            {(Object.keys(BACKEND_META) as WaveBackend[]).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => pickBackend(b)}
                aria-pressed={backend === b}
                className={cn(
                  "flex-1 min-w-[240px] max-w-[420px] text-left px-4 py-3 border rounded-[var(--radius-sm)] transition-colors",
                  backend === b
                    ? "border-fg bg-surface-2"
                    : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <span className={cn("block text-[13px] font-semibold", backend === b ? "text-fg" : "text-fg-2")}>
                  {backend === b ? "● " : "○ "}{BACKEND_META[b].title}
                </span>
                <span className="block text-[11.5px] text-fg-4 mt-1 leading-snug">{BACKEND_META[b].desc}</span>
              </button>
            ))}
            <label className="flex flex-col justify-center gap-1 px-4 py-3 border border-line rounded-[var(--radius-sm)] bg-surface">
              <span className="[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-4">Max/Welle</span>
              <input
                type="number"
                min={5}
                max={200}
                value={maxProfiles}
                onChange={(e) => setMaxProfiles(Math.min(200, Math.max(5, Number(e.target.value) || 5)))}
                onBlur={() => void persistScrape({ maxProfiles })}
                className="w-20 px-2 py-1 text-sm bg-bg text-fg border border-line-strong rounded-[var(--radius-sm)] [font-family:var(--font-mono)] focus:border-fg focus:outline-none"
              />
            </label>
          </div>
        </WaveSection>

        <WaveSection title="Apps" hint="Multi-Select, nur LIVE">
          <div className="flex flex-wrap gap-2">
            {appOpts.map((a) => (
              <Chip key={a.slug} name="apps" value={a.slug} type="checkbox" checked={apps.includes(a.slug)} onChange={() => setApps((p) => toggle(p, a.slug))} label={a.name} />
            ))}
          </div>
        </WaveSection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-5 border-y border-line">
          <WaveSection title="Plattformen">
            <div className="flex flex-wrap gap-2">
              <Chip name="platforms" value="tiktok" type="checkbox" checked={platforms.includes("tiktok")} onChange={() => setPlatforms((p) => toggle(p, "tiktok"))} label="TikTok" />
              <Chip name="platforms" value="instagram" type="checkbox" checked={platforms.includes("instagram")} onChange={() => setPlatforms((p) => toggle(p, "instagram"))} label="Instagram" />
            </div>
          </WaveSection>
          <WaveSection title="Größen">
            <div className="flex flex-wrap gap-2">
              {sizeOpts.map((s) => (
                <Chip key={s.value} name="size_buckets" value={s.value} type="checkbox" checked={sizes.includes(s.value)} onChange={() => setSizes((p) => toggle(p, s.value))} label={s.label} sub={s.range} />
              ))}
            </div>
          </WaveSection>
          <div className="md:col-span-2">
            <WaveSection title="Region" hint="Single-Select — wählt Hashtag-Bucket + Mail-Template">
              <div className="flex flex-wrap gap-2">
                {regions.map((r) => (
                  <Chip key={r.value} name="languages" value={r.value} type="radio" checked={region === r.value} onChange={() => setRegion(r.value)} label={`${r.flag} ${r.label}`} sub={r.market} />
                ))}
              </div>
            </WaveSection>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-6 items-end">
          <label className="flex flex-col">
            <div className="flex justify-between items-baseline mb-2">
              <span className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3">Anzahl pro App</span>
              <span className="[font-family:var(--font-display)] font-extrabold text-[28px] leading-none tracking-[-0.02em] text-fg [font-variant-numeric:tabular-nums]">{count}</span>
            </div>
            <input type="range" name="count_per_app" min={5} max={100} step={5} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full cursor-pointer [accent-color:var(--fg)]" />
            <div className="flex justify-between [font-family:var(--font-mono)] text-[10px] text-fg-4 mt-1">
              <span>5</span><span>25</span><span>50</span><span>75</span><span>100</span>
            </div>
          </label>
          <label className="flex flex-col">
            <span className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3 mb-1.5">Niche-Keyword</span>
            <input type="text" name="niche" maxLength={80} value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="optional, z.B. yarn" className={inputCls} />
          </label>
        </div>

        <details open={mailOpen} onToggle={(e) => setMailOpen((e.target as HTMLDetailsElement).open)} className="border border-line rounded-[var(--radius-sm)] bg-surface-2">
          <summary className="cursor-pointer px-4 py-3 text-[13px] font-semibold text-fg-2 select-none flex justify-between items-center marker:content-none">
            <span>Mail bearbeiten <span className="text-fg-4 font-normal text-[11px] ml-1">(default: App-Template aus DB)</span></span>
            <span className="[font-family:var(--font-mono)] text-[11px] text-fg-4">{mailDirty ? "✎ override aktiv" : mailOpen ? "geöffnet" : "App-Default"}</span>
          </summary>
          <div className="px-4 pb-4 flex flex-col gap-3.5">
            <label className="flex flex-col">
              <span className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3 mb-1.5">Mail-Betreff</span>
              <input type="text" name="mail_subject" maxLength={200} value={subject} onChange={(e) => { setSubject(e.target.value); setMailDirty(true); }} className={cn(inputCls, "[font-family:var(--font-mono)]")} />
            </label>
            <label className="flex flex-col">
              <span className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3 mb-1.5">Mail-Text <span className="font-normal normal-case tracking-normal text-fg-4">{"{{name}}, {{handle}}, {{app_name}} werden pro Target ersetzt"}</span></span>
              <textarea name="mail_body" rows={12} value={body} onChange={(e) => { setBody(e.target.value); setMailDirty(true); }} className={cn(inputCls, "resize-y leading-relaxed")} />
            </label>
            {tplStatus && <div className="[font-family:var(--font-mono)] text-[11px] italic text-fg-4">{tplStatus}</div>}
          </div>
        </details>

        <div className="flex justify-between items-center gap-4 pt-4 border-t border-line flex-wrap">
          <div className="[font-family:var(--font-mono)] text-[12px] text-fg-3">
            <span className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3 mr-2">Schätzung</span>
            {cost.waves === 0 || (!platforms.length) ? (
              "— Apps + Plattformen wählen"
            ) : (
              <>
                {cost.waves} {cost.waves === 1 ? "Welle" : "Wellen"} · ~{cost.total.toLocaleString("de-CH")} Profile ·{" "}
                <strong className={cn(cost.usd >= COST_CONFIRM_USD && "text-warning")}>≈ ${cost.usd.toFixed(2)}</strong> Apify
                {cost.evomiCredits && <span className="text-fg-4"> + Evomi-Credits (TikTok)</span>}
              </>
            )}
          </div>
          <input type="hidden" name="cost_confirmed" value={confirmed ? "1" : ""} />
          <div className="flex items-center gap-3">
            {error && <span className="text-[12px] text-danger">{error}</span>}
            <Button type="submit" variant="pop">Welle starten →</Button>
          </div>
        </div>
      </form>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Welle wirklich starten?</AlertDialogTitle>
            <AlertDialogDescription>
              Geschätzter Apify-Spend: <strong>${cost.usd.toFixed(2)}</strong> über {cost.waves} {cost.waves === 1 ? "Welle" : "Wellen"}. Wird sofort ausgeführt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild><Button type="button" variant="ghost">Abbrechen</Button></AlertDialogCancel>
            <AlertDialogAction asChild><Button type="button" variant="pop" onClick={confirmAndSubmit}>Welle starten</Button></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
