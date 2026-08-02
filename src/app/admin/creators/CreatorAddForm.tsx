"use client";

// Klapp-Formular zum Anlegen eines Creators von Hand (Phase 0 aus dem PRD:
// die ersten Creator werden eingetragen, der Tracking-Link kommt aus
// /admin/affiliate-create). Gleiche Mechanik wie OutreachAddForm — details/
// summary statt eigenem State, POST auf eine Route-Handler-URL.

import { useState } from "react";
import { Card } from "@/components/ui/card";

export interface CreatorFormApp {
  slug: string;
  name: string;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3">
        {label}
      </span>
      {children}
      {hint ? <span className="text-[11px] text-fg-3">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  "h-[34px] px-3 rounded-[var(--radius-sm)] bg-surface border border-line text-[13px] text-fg placeholder:text-fg-3 w-full";

export default function CreatorAddForm({ apps }: { apps: CreatorFormApp[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="px-5 py-4 mb-7">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 [font-family:var(--font-mono)] text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-2 hover:text-fg transition-colors"
      >
        <span className="inline-block w-3">{open ? "−" : "+"}</span>
        Creator von Hand anlegen
      </button>

      {open ? (
        <form method="post" action="/admin/creators/add" className="mt-4 grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
          <Field label="Handle *" hint="ohne @">
            <input name="handle" required placeholder="sidehustle_max" className={inputCls} />
          </Field>

          <Field label="Plattform">
            <select name="platform" defaultValue="tiktok" className={inputCls}>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
            </select>
          </Field>

          <Field label="App *" hint="was dieser Creator bewirbt">
            <select name="app" required defaultValue="" className={inputCls}>
              <option value="" disabled>
                App wählen …
              </option>
              {apps.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Herkunft" hint="welcher Recruiting-Kanal, z.B. tiktok:@sidehustle_de">
            <input name="source" placeholder="tiktok:@…" className={inputCls} />
          </Field>

          <Field label="Name">
            <input name="display_name" className={inputCls} />
          </Field>

          <Field label="E-Mail">
            <input name="email" type="email" className={inputCls} />
          </Field>

          <Field label="Follower">
            <input name="follower_estimate" inputMode="numeric" placeholder="12000" className={inputCls} />
          </Field>

          <Field label="Sprache">
            <input name="language" defaultValue="de" maxLength={5} className={inputCls} />
          </Field>

          <Field label="Tracking-Handle" hint="aus /admin/affiliate-create">
            <input name="tracking_handle" placeholder="maxk" className={inputCls} />
          </Field>

          <Field label="Tracking-Link" hint="mit Link = sofort aktiv, ohne = beworben">
            <input name="tracking_url" placeholder="https://…/i/maxk" className={inputCls} />
          </Field>

          <Field label="Notiz">
            <input name="notes" className={inputCls} />
          </Field>

          <div className="flex items-end">
            <button
              type="submit"
              className="h-[34px] px-4 rounded-[var(--radius-sm)] bg-fg text-accent-fg [font-family:var(--font-mono)] text-[11px] font-semibold uppercase tracking-[0.08em]"
            >
              Anlegen
            </button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
