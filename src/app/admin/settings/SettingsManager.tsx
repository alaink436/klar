"use client";

// Klar Control · Settings, rebuilt on the shadcn/ui kit (Card/Button/Input/
// Label/Badge/Switch/Table) to match the rest of /admin (see BrainAccessManager).
// Behaviour is unchanged: every form still posts natively to the same server
// routes (/admin/settings/save with section=global|notif, and /admin/invite).
// No client state — switches are native checkboxes so they submit in the form.

import { SlidersHorizontal, Bell, UserPlus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  TextureCard,
  TextureCardContent,
  TextureCardDescription,
  TextureCardFooter,
  TextureCardHeader,
  TextureCardTitle,
  TextureSeparator,
} from "@/components/ui/texture-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReactNode } from "react";

export interface SettingsData {
  shader_enabled: boolean;
  notification_trigger_inquiry: boolean;
  notification_batch_size: number;
  notification_recipient_email: string;
}
export interface InviteRow {
  name: string;
  email: string;
  url: string;
  expiresFmt: string;
  status: "open" | "expired" | "used";
}

const selectCls =
  "w-full px-3.5 py-2.5 text-sm [font-family:var(--font-body)] text-fg bg-bg border border-line-strong rounded-[var(--radius-sm)] cursor-pointer focus:border-fg focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--fg)_12%,transparent)]";

// Ab lg eigene Spalten; darunter (Handy) stehen URL, Status und Ablauf unter
// dem Namen.
const BREIT = "hidden lg:table-cell";

// One toggle row: clickable label wrapping the Switch + name/description.
function Toggle({
  name,
  defaultChecked,
  title,
  desc,
}: {
  name: string;
  defaultChecked: boolean;
  title: string;
  desc: string;
}) {
  return (
    <label className="flex items-start gap-3.5 rounded-[var(--radius-sm)] border border-line bg-white/[.02] p-3.5 cursor-pointer transition-colors hover:bg-white/[.04]">
      <Switch name={name} value="1" defaultChecked={defaultChecked} className="mt-0.5" />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium text-fg">{title}</span>
        <span className="text-[12.5px] leading-relaxed text-fg-3">{desc}</span>
      </span>
    </label>
  );
}

function Field({ label, help, children }: { label: string; help: string; children: ReactNode }) {
  return (
    <label className="flex flex-1 min-w-[200px] flex-col gap-1.5">
      <span className="[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-3">
        {label}
      </span>
      {children}
      <span className="text-xs leading-relaxed text-fg-4">{help}</span>
    </label>
  );
}

export default function SettingsManager({
  settings,
  invites,
}: {
  settings: SettingsData;
  invites: InviteRow[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* ── Globale Einstellungen ── */}
      <TextureCard>
        <TextureCardHeader className="flex-col items-start gap-1.5">
          <TextureCardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-fg-3" /> Globale Einstellungen
          </TextureCardTitle>
          <TextureCardDescription>Studio-weite Schalter für die öffentliche Seite.</TextureCardDescription>
        </TextureCardHeader>
        <form method="POST" action="/admin/settings/save">
          <input type="hidden" name="section" value="global" />
          <TextureCardContent className="flex flex-col gap-3">
            <Toggle
              name="shader_enabled"
              defaultChecked={settings.shader_enabled}
              title="Marketing-Shader (Smoke-BG)"
              desc="Animation auf der getklar.org-Homepage. Aus = statischer Hintergrund, schnellerer Load."
            />
          </TextureCardContent>
          <TextureCardFooter>
            <Button type="submit" variant="pill">
              <Save /> Speichern
            </Button>
          </TextureCardFooter>
        </form>
      </TextureCard>

      {/* ── Benachrichtigungen ── */}
      <TextureCard>
        <TextureCardHeader className="flex-col items-start gap-1.5">
          <TextureCardTitle className="flex items-center gap-2">
            <Bell className="size-4 text-fg-3" /> Benachrichtigungen
          </TextureCardTitle>
          <TextureCardDescription>Wann und wie oft du eine Email zu Inbox-Events bekommst.</TextureCardDescription>
        </TextureCardHeader>
        <form method="POST" action="/admin/settings/save">
          <input type="hidden" name="section" value="notif" />
          <TextureCardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <span className="[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-3">
                Trigger
              </span>
              <Toggle
                name="notification_trigger_inquiry"
                defaultChecked={settings.notification_trigger_inquiry}
                title="Neue Inquiry"
                desc="Wenn jemand über die Website eine Anfrage schickt."
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <Field label="Batch-Grösse" help="Wieviele Events sammeln, bevor eine Digest-Mail rausgeht.">
                <select name="notification_batch_size" defaultValue={String(settings.notification_batch_size)} className={selectCls}>
                  {[1, 5, 10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "Sofort (jedes Event)" : `Alle ${n} Events`}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Empfänger" help="Email-Adresse, die die Digest bekommt.">
                <Input type="email" name="notification_recipient_email" required defaultValue={settings.notification_recipient_email} />
              </Field>
            </div>
          </TextureCardContent>
          <TextureCardFooter>
            <Button type="submit" variant="pill">
              <Save /> Speichern
            </Button>
          </TextureCardFooter>
        </form>
      </TextureCard>

      {/* ── Zugriff / Invites ── */}
      <TextureCard>
        <TextureCardHeader className="flex-col items-start gap-1.5">
          <TextureCardTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-fg-3" /> Zugriff · neue Person einladen
          </TextureCardTitle>
          <TextureCardDescription>
            Erstellt einen Einmal-Link, der ein neues Gerät ohne Admin-Key registriert. Das TOTP-Secret muss separat (z.B. via Signal) geteilt werden — der Link allein reicht nicht.
          </TextureCardDescription>
        </TextureCardHeader>
        <form method="POST" action="/admin/invite">
          <TextureCardContent className="flex flex-wrap gap-4">
            <Field label="Name (optional)" help="">
              <Input type="text" name="name" maxLength={60} placeholder="z.B. Lukas" />
            </Field>
            <Field label="Email (optional)" help="">
              <Input type="email" name="email" placeholder="lukas@example.com" />
            </Field>
            <label className="flex w-[140px] flex-col gap-1.5">
              <span className="[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-3">Gültig</span>
              <select name="ttl_days" defaultValue="7" className={selectCls}>
                <option value="1">1 Tag</option>
                <option value="3">3 Tage</option>
                <option value="7">7 Tage</option>
                <option value="30">30 Tage</option>
              </select>
            </label>
          </TextureCardContent>
          <TextureCardFooter>
            <Button type="submit" variant="pill">
              <UserPlus /> Invite-Link erzeugen
            </Button>
          </TextureCardFooter>
        </form>

        <TextureSeparator />
        <div>
          {invites.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 px-6 py-8 text-center text-fg-3">
              <div className="text-sm font-medium text-fg">Noch keine Invites generiert</div>
              <div className="text-[13px]">Erzeuge oben einen Einmal-Link, um ein neues Gerät freizuschalten.</div>
            </div>
          ) : (
            <Table className="rounded-none border-0 bg-transparent [&_th]:bg-transparent">
              <TableHeader>
                <TableRow>
                  <TableHead>Eingeladen</TableHead>
                  <TableHead className={BREIT}>URL</TableHead>
                  <TableHead className={BREIT}>Läuft ab</TableHead>
                  <TableHead className={BREIT}>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((inv) => {
                  const url = (
                    <code className="inline-block max-w-[340px] break-all rounded-md bg-white/[.05] px-2 py-1 text-[11.5px] [font-family:var(--font-mono)] text-fg-2">
                      {inv.url}
                    </code>
                  );
                  const status =
                    inv.status === "open" ? (
                      <Badge tone="ok" dot>offen</Badge>
                    ) : inv.status === "expired" ? (
                      <Badge tone="danger" dot>abgelaufen</Badge>
                    ) : (
                      <Badge tone="neutral" dot>eingelöst</Badge>
                    );
                  return (
                    <TableRow key={inv.url}>
                      <TableCell>
                        <div className="font-medium text-fg">{inv.name || "—"}</div>
                        {inv.email ? <div className="text-[11px] text-fg-4">{inv.email}</div> : null}
                        {/* Unter lg dieselben Angaben als Zeilen unter dem Namen. */}
                        <div className="mt-2.5 flex flex-col items-start gap-2 text-[12px] text-fg-3 lg:hidden">
                          {url}
                          <div className="flex items-center gap-3">
                            {status}
                            {inv.expiresFmt}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={BREIT}>{url}</TableCell>
                      <TableCell className={`${BREIT} text-fg-3`}>{inv.expiresFmt}</TableCell>
                      <TableCell className={BREIT}>{status}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </TextureCard>
    </div>
  );
}
