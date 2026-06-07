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
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  auto_accept_affiliates: boolean;
  notification_trigger_inquiry: boolean;
  notification_trigger_complete: boolean;
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
    <label className="flex items-start gap-3.5 rounded-[var(--radius-sm)] border border-line bg-surface-2 p-3.5 cursor-pointer transition-colors hover:border-line-strong">
      <Switch name={name} value="1" defaultChecked={defaultChecked} className="mt-0.5" />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-semibold text-fg">{title}</span>
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-fg-3" /> Globale Einstellungen
          </CardTitle>
          <CardDescription>Studio-weite Schalter für die öffentliche Seite und das Affiliate-Handling.</CardDescription>
        </CardHeader>
        <form method="POST" action="/admin/settings/save">
          <input type="hidden" name="section" value="global" />
          <CardContent className="flex flex-col gap-3">
            <Toggle
              name="shader_enabled"
              defaultChecked={settings.shader_enabled}
              title="Marketing-Shader (Smoke-BG)"
              desc="Animation auf der getklar.org-Homepage. Aus = statischer Hintergrund, schnellerer Load."
            />
            <Toggle
              name="auto_accept_affiliates"
              defaultChecked={settings.auto_accept_affiliates}
              title="Affiliates automatisch annehmen"
              desc="Eingehende Inquiries werden direkt approved + Brevo-Mail. Aus = bleibt im Inbox-View für manuellen Approve."
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" variant="pop">
              <Save /> Speichern
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* ── Benachrichtigungen ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4 text-fg-3" /> Benachrichtigungen
          </CardTitle>
          <CardDescription>Wann und wie oft du eine Email zu Inbox-Events bekommst.</CardDescription>
        </CardHeader>
        <form method="POST" action="/admin/settings/save">
          <input type="hidden" name="section" value="notif" />
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <span className="[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-3">
                Trigger
              </span>
              <Toggle
                name="notification_trigger_inquiry"
                defaultChecked={settings.notification_trigger_inquiry}
                title="Neue Inquiry"
                desc="Wenn jemand das Affiliate-Bewerbungsformular ausfüllt."
              />
              <Toggle
                name="notification_trigger_complete"
                defaultChecked={settings.notification_trigger_complete}
                title="Setup abgeschlossen"
                desc="Wenn ein eingeladener Influencer den /affiliate/[token]-Apply-Flow durchgeklickt hat."
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
          </CardContent>
          <CardFooter>
            <Button type="submit" variant="pop">
              <Save /> Speichern
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* ── Zugriff / Invites ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-fg-3" /> Zugriff · neue Person einladen
          </CardTitle>
          <CardDescription>
            Erstellt einen Einmal-Link, der ein neues Gerät ohne Admin-Key registriert. Das TOTP-Secret muss separat (z.B. via Signal) geteilt werden — der Link allein reicht nicht.
          </CardDescription>
        </CardHeader>
        <form method="POST" action="/admin/invite">
          <CardContent className="flex flex-wrap gap-4">
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
          </CardContent>
          <CardFooter>
            <Button type="submit" variant="pop">
              <UserPlus /> Invite-Link erzeugen
            </Button>
          </CardFooter>
        </form>

        <CardContent>
          {invites.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 rounded-[var(--radius)] border border-dashed border-line-strong bg-surface-2/40 px-6 py-8 text-center text-fg-3">
              <div className="text-sm font-semibold text-fg-2">Noch keine Invites generiert</div>
              <div className="text-[13px]">Erzeuge oben einen Einmal-Link, um ein neues Gerät freizuschalten.</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Eingeladen</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Läuft ab</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((inv) => (
                  <TableRow key={inv.url}>
                    <TableCell>
                      <div className="font-semibold text-fg">{inv.name || "—"}</div>
                      {inv.email ? <div className="text-[11px] text-fg-4">{inv.email}</div> : null}
                    </TableCell>
                    <TableCell>
                      <code className="inline-block max-w-[340px] break-all rounded bg-surface-2 px-2 py-1 text-[11.5px] [font-family:var(--font-mono)] text-fg-2">
                        {inv.url}
                      </code>
                    </TableCell>
                    <TableCell className="text-fg-3">{inv.expiresFmt}</TableCell>
                    <TableCell>
                      {inv.status === "open" ? (
                        <Badge tone="ok" dot>offen</Badge>
                      ) : inv.status === "expired" ? (
                        <Badge tone="danger" dot>abgelaufen</Badge>
                      ) : (
                        <Badge tone="neutral" dot>eingelöst</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
