"use client";

// "Target hinzufügen" form on the shadcn kit. Replaces the old addForm HTML
// string. The picked apps are collected into the hidden `for_apps` field (comma
// separated, as /admin/outreach/add expects) via React state, which removes the
// last reason OutreachClientScripts existed — so that file can go too. Submit is
// a native POST.

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AddFormApp { slug: string; name: string }

const inputCls =
  "w-full px-3 py-2 text-sm bg-bg text-fg border border-line-strong rounded-[var(--radius-sm)] focus:border-fg focus:outline-none";
const labelCls = "[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-3";

export default function OutreachAddForm({ apps }: { apps: AddFormApp[] }) {
  const [open, setOpen] = useState(false);
  const [forApps, setForApps] = useState<string[]>([]);
  const toggle = (s: string) => setForApps((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  return (
    <Card className="p-0 overflow-hidden mb-6">
      <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer px-5 py-3.5 font-semibold text-[13px] text-fg-2 select-none marker:content-none">
          + Target hinzufügen
        </summary>
        <form method="POST" action="/admin/outreach/add" className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Handle*</span>
            <input name="handle" required maxLength={64} pattern="[A-Za-z0-9_.-]{1,64}" placeholder="marie_knits" className={cn(inputCls, "[font-family:var(--font-mono)]")} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Plattform*</span>
            <select name="platform" required defaultValue="tiktok" className={inputCls}>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Display-Name</span>
            <input name="display_name" maxLength={80} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Profile-URL</span>
            <input type="url" name="profile_url" maxLength={500} placeholder="https://tiktok.com/@…" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Follower (est.)</span>
            <input type="number" name="follower_estimate" min={0} max={100000000} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Niche</span>
            <input name="niche" maxLength={80} placeholder="yarn, fitness, moto…" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Sprache</span>
            <select name="language" defaultValue="de" className={inputCls}>
              <option value="de">de</option><option value="en">en</option><option value="fr">fr</option><option value="es">es</option><option value="it">it</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Priority (1=top)</span>
            <input type="number" name="priority" min={1} max={5} defaultValue={3} className={inputCls} />
          </label>
          <div className="md:col-span-3 flex flex-col gap-1.5">
            <span className={labelCls}>Passende Apps</span>
            <div className="flex flex-wrap gap-2">
              {apps.map((a) => (
                <label
                  key={a.slug}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-[var(--radius-sm)] cursor-pointer text-[12px] select-none",
                    forApps.includes(a.slug) ? "border-fg bg-surface-2 text-fg" : "border-line bg-surface text-fg-3 hover:border-line-strong",
                  )}
                >
                  <input type="checkbox" checked={forApps.includes(a.slug)} onChange={() => toggle(a.slug)} className="accent-[var(--fg)]" />
                  {a.name}
                </label>
              ))}
            </div>
            <input type="hidden" name="for_apps" value={forApps.join(",")} />
          </div>
          <label className="md:col-span-3 flex flex-col gap-1">
            <span className={labelCls}>Notes</span>
            <textarea name="notes" rows={2} maxLength={1000} className={cn(inputCls, "resize-y")} />
          </label>
          <div className="md:col-span-3">
            <Button type="submit" variant="outline">Target anlegen</Button>
          </div>
        </form>
      </details>
    </Card>
  );
}
