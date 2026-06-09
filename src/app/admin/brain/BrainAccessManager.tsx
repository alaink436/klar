"use client";

// AI-Brain · Zugang. Two managers, rebuilt on the shadcn/ui kit:
//   - API-Tokens  → mint (scopes brain:read / vault:use) + revoke. Create posts
//     natively to /admin/tokens, which renders the raw token ONCE on its own
//     page. Revoke confirms via AlertDialog.
//   - Brain-Mitglieder → invite (clearance + folder scope) + revoke. Posts to
//     /admin/brain-invite. The person then signs in at /brain/login.
// Both POST routes redirect back to /admin/brain with ?msg/?err.

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, UserPlus, Trash2, Users, Plus, ShieldCheck, Mail, Ban, MonitorSmartphone, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

export interface TokenRow {
  id: string;
  label: string;
  prefix: string;
  scopes: string[];
  lastUsed: string;
  revoked: boolean;
}
export interface MemberRow {
  email: string;
  clearance: "brain" | "full";
  folders: string[];
  scope: string;
  lastSeen: string;
  revoked: boolean;
}
export interface FolderOpt {
  key: string;
  label: string;
  color: string;
  count: number;
  checked: boolean;
}

type Confirm =
  | { kind: "token-revoke"; id: string; label: string }
  | { kind: "token-delete"; id: string; label: string; active: boolean }
  | { kind: "member"; email: string }
  | null;

const selectCls =
  "w-full px-3.5 py-2.5 text-sm [font-family:var(--font-body)] text-fg bg-bg border border-line-strong rounded-[var(--radius-sm)] cursor-pointer focus:border-fg focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--fg)_12%,transparent)]";
const chipCls =
  "inline-flex items-center gap-2 px-3 py-1.5 border border-line rounded-full bg-surface-2 text-[12.5px] text-fg-2 cursor-pointer transition-colors hover:border-line-strong has-[:checked]:border-fg has-[:checked]:text-fg";

// One section card: header (icon + title + count + description) and a primary
// action on the right, table/empty below.
function Section({
  icon,
  title,
  count,
  desc,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  desc: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4 p-6 pb-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 [font-family:var(--font-display)] font-bold text-[16px] tracking-[-0.01em] text-fg">
            <span className="text-fg-3">{icon}</span>
            {title}
            <Badge>{count}</Badge>
          </div>
          <p className="[font-family:var(--font-editorial)] italic text-sm leading-relaxed text-fg-3 max-w-[64ch]">
            {desc}
          </p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      <div className="px-6 pb-6">{children}</div>
    </Card>
  );
}

function EmptyState({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-center px-6 py-9 border border-dashed border-line-strong rounded-[var(--radius)] bg-surface-2/40 text-fg-3">
      <span className="text-fg-4">{icon}</span>
      <div className="[font-family:var(--font-body)] font-semibold text-sm text-fg-2">{title}</div>
      <div className="text-[13px] max-w-[44ch] leading-relaxed">{sub}</div>
    </div>
  );
}

export default function BrainAccessManager({
  tokens,
  members,
  folders,
  briefing,
  briefingBrain,
}: {
  tokens: TokenRow[];
  members: MemberRow[];
  folders: FolderOpt[];
  briefing: string;
  briefingBrain: string;
}) {
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const router = useRouter();

  // The two copyable agent prompts: full vault access vs read-only brain/RAG.
  const PROMPTS = [
    {
      key: "vault",
      title: "Voller Zugriff — Vault",
      badge: "vault:use",
      badgeTone: "warn" as const,
      desc:
        "Für dich / Leute mit Vault-Zugriff. Listet alle nutzbaren Vault-Keys samt Gateway-Aufruf — der Agent nutzt echte API-Keys, ohne den Klartext zu sehen. Token separat als KLAR_VAULT_TOKEN ablegen.",
      text: briefing,
    },
    {
      key: "brain",
      title: "Nur Learnings — RAG (read-only)",
      badge: "brain:read",
      badgeTone: "info" as const,
      desc:
        "Für Leute, die nur das Wissen wollen. Lädt alle Brain-Notes (Learnings, Projekt-Status …) read-only über den Export-Endpoint — kein Vault, keine Secrets. Token separat als KLAR_BRAIN_TOKEN ablegen.",
      text: briefingBrain,
    },
  ];
  const activePrompt = PROMPTS.find((p) => p.key === previewKey) ?? null;
  const activeTokens = tokens.filter((t) => !t.revoked).length;
  const activeMembers = members.filter((m) => !m.revoked).length;

  function openConfirm(c: Confirm) {
    setActionErr(null);
    setConfirm(c);
  }

  // Token revoke/delete via fetch + soft-refresh (no full reload): the row list
  // re-renders from fresh server data once router.refresh() resolves. On error
  // the dialog stays open and shows why. (Member revoke keeps its form-post.)
  async function runTokenConfirm() {
    if (!confirm || (confirm.kind !== "token-revoke" && confirm.kind !== "token-delete")) return;
    setBusy(true);
    setActionErr(null);
    try {
      const fd = new URLSearchParams();
      fd.set("action", confirm.kind === "token-delete" ? "delete" : "revoke");
      fd.set("id", confirm.id);
      const res = await fetch("/admin/tokens?json=1", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: fd.toString(),
      });
      const j = (await res.json().catch(() => ({ ok: false }))) as { ok?: boolean; error?: string };
      if (res.ok && j.ok) {
        setConfirm(null);
        router.refresh();
      } else {
        setActionErr(j.error || "Aktion fehlgeschlagen.");
      }
    } catch {
      setActionErr("Netzwerkfehler.");
    } finally {
      setBusy(false);
    }
  }

  // Copy one of the prompts; `key` drives the per-button "Kopiert ✓" feedback.
  function copyText(key: string, text: string) {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600);
      },
      () => {},
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Agent verbinden — zwei Prompts (Vault vs. Learnings/RAG) ── */}
      <Card className="p-6">
        <div className="flex flex-col gap-1.5 mb-4 min-w-0">
          <div className="flex items-center gap-2 [font-family:var(--font-display)] font-bold text-[16px] tracking-[-0.01em] text-fg">
            <span className="text-fg-3">
              <MonitorSmartphone className="size-4" />
            </span>
            Agent verbinden — zwei Prompts
          </div>
          <p className="[font-family:var(--font-editorial)] italic text-sm leading-relaxed text-fg-3 max-w-[64ch]">
            Kopier den passenden Prompt und füg ihn in Claude Code (oder einen anderen LLM-Agenten) ein.
            Beide enthalten keinen Token — den legst du separat ab. Erzeug den Token mit dem passenden
            Scope (<code>vault:use</code> bzw. <code>brain:read</code>).
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {PROMPTS.map((p) => (
            <div
              key={p.key}
              className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-sm)] border border-line bg-surface-2/40 p-4"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 font-semibold text-fg">
                  {p.title}
                  <Badge tone={p.badgeTone}>{p.badge}</Badge>
                </div>
                <p className="text-[13px] leading-relaxed text-fg-3 max-w-[60ch]">{p.desc}</p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreviewKey(p.key)}>
                  Vorschau
                </Button>
                <Button variant="pop" size="sm" onClick={() => copyText(p.key, p.text)}>
                  {copiedKey === p.key ? (
                    <>
                      <Check /> Kopiert
                    </>
                  ) : (
                    <>
                      <Copy /> Prompt kopieren
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Agent-Prompt — Vorschau */}
      <Dialog open={previewKey !== null} onOpenChange={(o) => { if (!o) setPreviewKey(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agent-Prompt — {activePrompt?.title ?? ""}</DialogTitle>
            <DialogDescription>
              Self-contained Briefing für einen LLM-Agenten. Enthält keinen Token — nur Endpoint, Regeln
              {activePrompt?.key === "vault" ? " und die Live-Secrets" : ""}.
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-[var(--radius-sm)] border border-line-strong bg-surface-2 p-4 text-[12px] leading-relaxed [font-family:var(--font-mono)] text-fg-2 whitespace-pre-wrap break-words">
            {activePrompt?.text ?? ""}
          </pre>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Schließen
              </Button>
            </DialogClose>
            <Button type="button" onClick={() => activePrompt && copyText("preview", activePrompt.text)}>
              {copiedKey === "preview" ? (
                <>
                  <Check /> Kopiert
                </>
              ) : (
                <>
                  <Copy /> Kopieren
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── API-Tokens ── */}
      <Section
        icon={<KeyRound className="size-4" />}
        title="API-Tokens"
        count={activeTokens}
        desc="Zugänge für Remote-Agents (Brain-API V2) und den Vault. Der Token wird nur einmal angezeigt und nur gehasht gespeichert — Widerruf jederzeit."
        action={
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="pop">
                <Plus /> Token erzeugen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>API-Token erzeugen</DialogTitle>
                <DialogDescription>
                  Wird sofort einmalig angezeigt und nur als SHA-256-Hash gespeichert. Danach nicht mehr abrufbar.
                </DialogDescription>
              </DialogHeader>
              <form method="POST" action="/admin/tokens" className="flex flex-col gap-4">
                <input type="hidden" name="action" value="create" />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tok-label">Label</Label>
                  <Input id="tok-label" name="label" maxLength={80} placeholder="z.B. MacBook · Claude Code" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Scopes</Label>
                  <div className="flex flex-wrap gap-2">
                    <label className={chipCls}>
                      <input type="checkbox" name="scope_brain" defaultChecked className="accent-[var(--accent)]" /> brain:read
                    </label>
                    <label className={chipCls}>
                      <input type="checkbox" name="scope_vault" className="accent-[var(--accent)]" /> vault:use
                    </label>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="ghost">
                      Abbrechen
                    </Button>
                  </DialogClose>
                  <Button type="submit">Token erzeugen</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      >
        {tokens.length === 0 ? (
          <EmptyState
            icon={<KeyRound className="size-6" strokeWidth={1.5} />}
            title="Noch keine Tokens"
            sub="Erzeuge einen Token, damit ein Remote-Agent (Claude Code auf einem anderen Gerät) das Brain laden oder den Vault nutzen kann."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead className="text-right">Zuletzt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-semibold text-fg">{t.label}</div>
                    <div className="text-[11px] text-fg-4 [font-family:var(--font-mono)]">{t.prefix}…</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {t.scopes.map((s) => (
                        <Badge key={s} tone={s === "vault:use" ? "warn" : "info"}>
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-fg-3">{t.lastUsed}</TableCell>
                  <TableCell>
                    {t.revoked ? (
                      <Badge tone="danger" dot>
                        entzogen
                      </Badge>
                    ) : (
                      <Badge tone="ok" dot>
                        aktiv
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!t.revoked && (
                        <Button variant="outline" size="sm" onClick={() => openConfirm({ kind: "token-revoke", id: t.id, label: t.label })}>
                          <Ban /> Widerrufen
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openConfirm({ kind: "token-delete", id: t.id, label: t.label, active: !t.revoked })}>
                        <Trash2 /> Löschen
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      {/* ── Brain-Mitglieder ── */}
      <Section
        icon={<Users className="size-4" />}
        title="Brain-Mitglieder"
        count={activeMembers}
        desc="Personen, die das AI-Brain unter /brain lesen dürfen. „Voll“ = alle Bereiche (ausser Secrets), „Nur Bereiche“ = nur die gewählten Ordner."
        action={
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="pop">
                <UserPlus /> Mitglied einladen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Brain-Mitglied einladen</DialogTitle>
                <DialogDescription>
                  Die Person meldet sich danach selbst per Magic-Link unter /brain/login mit dieser Email an.
                </DialogDescription>
              </DialogHeader>
              <form method="POST" action="/admin/brain-invite" className="flex flex-col gap-4">
                <input type="hidden" name="action" value="invite" />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bm-email">Email</Label>
                  <Input id="bm-email" type="email" name="email" required placeholder="person@example.com" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bm-clearance">Clearance</Label>
                  <select id="bm-clearance" name="clearance" className={selectCls} defaultValue="brain">
                    <option value="brain">Nur Bereiche</option>
                    <option value="full">Voll (alle Ordner)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Bereiche (bei Clearance „Nur Bereiche“)</Label>
                  <div className="flex flex-wrap gap-2">
                    {folders.map((f) => (
                      <label key={f.key} className={chipCls}>
                        <input type="checkbox" name="folders" value={f.key} defaultChecked={f.checked} className="accent-[var(--accent)]" />
                        <span className="size-2 rounded-full" style={{ background: f.color }} />
                        {f.label} <span className="text-fg-4">({f.count})</span>
                      </label>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="ghost">
                      Abbrechen
                    </Button>
                  </DialogClose>
                  <Button type="submit">
                    <Mail /> Zugang erstellen
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      >
        {members.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" strokeWidth={1.5} />}
            title="Noch keine Brain-Mitglieder"
            sub="Lade jemanden per Email ein, das AI-Brain unter /brain zu lesen — mit vollem Zugriff oder auf bestimmte Bereiche beschränkt."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mitglied</TableHead>
                <TableHead>Clearance</TableHead>
                <TableHead className="text-right">Zuletzt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.email}>
                  <TableCell>
                    <div className="font-semibold text-fg">{m.email}</div>
                    <div className="text-[11px] text-fg-4">{m.scope}</div>
                  </TableCell>
                  <TableCell>
                    {m.clearance === "full" ? (
                      <Badge tone="info">
                        <ShieldCheck className="size-3" /> voll
                      </Badge>
                    ) : (
                      <Badge>{m.folders.length} Bereiche</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-fg-3">{m.lastSeen}</TableCell>
                  <TableCell>
                    {m.revoked ? (
                      <Badge tone="danger" dot>
                        entzogen
                      </Badge>
                    ) : (
                      <Badge tone="ok" dot>
                        aktiv
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!m.revoked && (
                      <Button variant="outline" size="sm" onClick={() => openConfirm({ kind: "member", email: m.email })}>
                        <Ban /> Entziehen
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      {/* Confirm dialog — token revoke/delete + member revoke share one shell */}
      <AlertDialog open={confirm !== null} onOpenChange={(o) => { if (!o && !busy) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "token-revoke"
                ? "Token widerrufen?"
                : confirm?.kind === "token-delete"
                  ? "Token löschen?"
                  : "Brain-Zugang entziehen?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "token-revoke"
                ? `„${confirm.label}“ wird sofort ungültig. Geräte/Agents mit diesem Token verlieren den Zugriff.`
                : confirm?.kind === "token-delete"
                  ? confirm.active
                    ? `„${confirm.label}“ ist noch aktiv und wird sofort ungültig und endgültig entfernt. Geräte/Agents mit diesem Token verlieren den Zugriff. Das lässt sich nicht rückgängig machen.`
                    : `„${confirm.label}“ wird endgültig aus der Liste entfernt. Das lässt sich nicht rückgängig machen.`
                  : confirm?.kind === "member"
                    ? `${confirm.email} verliert den Zugriff auf /brain. Re-Einladen stellt ihn wieder her.`
                    : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionErr && <p className="text-danger text-[13px] -mt-1">{actionErr}</p>}
          {confirm?.kind === "member" ? (
            // Member revoke: plain form-post (redirect back to /admin/brain).
            <form method="POST" action="/admin/brain-invite">
              <input type="hidden" name="action" value="revoke" />
              <input type="hidden" name="email" value={confirm.email} />
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <Button type="button" variant="ghost">Abbrechen</Button>
                </AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Button type="submit" variant="danger">Entziehen</Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </form>
          ) : (
            // Token revoke/delete: async fetch + soft-refresh, dialog closes on success.
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="ghost" disabled={busy}>Abbrechen</Button>
              </AlertDialogCancel>
              <Button type="button" variant="danger" disabled={busy} onClick={runTokenConfirm}>
                {busy
                  ? "…"
                  : confirm?.kind === "token-revoke"
                    ? "Widerrufen"
                    : "Löschen"}
              </Button>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
