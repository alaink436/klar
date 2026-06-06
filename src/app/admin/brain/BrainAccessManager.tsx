"use client";

// AI-Brain · Zugang. Two managers, moved here from /admin/settings and rebuilt
// on the shadcn/ui kit:
//   - API-Tokens  → mint (scopes brain:read / vault:use) + revoke. Create posts
//     natively to /admin/tokens, which renders the raw token ONCE on its own
//     page. Revoke confirms via AlertDialog.
//   - Brain-Mitglieder → invite (clearance + folder scope) + revoke. Posts to
//     /admin/brain-invite. The person then signs in at /brain/login.
// Both POST routes redirect back to /admin/brain with ?msg/?err.

import { useState } from "react";
import { KeyRound, UserPlus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

type Revoke =
  | { kind: "token"; id: string; label: string }
  | { kind: "member"; email: string }
  | null;

const selectCls =
  "w-full px-3.5 py-2.5 text-sm [font-family:var(--font-body)] text-fg bg-bg border border-line-strong rounded-[var(--radius-sm)] cursor-pointer focus:border-fg focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--fg)_12%,transparent)]";
const chipCls =
  "inline-flex items-center gap-2 px-3 py-1.5 border border-line rounded-full bg-surface-2 text-[12.5px] text-fg-2 cursor-pointer transition-colors hover:border-line-strong";

export default function BrainAccessManager({
  tokens,
  members,
  folders,
}: {
  tokens: TokenRow[];
  members: MemberRow[];
  folders: FolderOpt[];
}) {
  const [revoke, setRevoke] = useState<Revoke>(null);

  return (
    <div className="flex flex-col gap-6">
      {/* ── API-Tokens ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-fg-3" /> API-Tokens
          </CardTitle>
          <CardDescription>
            Zugänge für Remote-Agents (Brain-API V2) und den Vault. Der Token wird nur einmal angezeigt und nur gehasht
            gespeichert — Widerruf jederzeit.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <form method="POST" action="/admin/tokens" className="flex flex-col gap-4">
            <input type="hidden" name="action" value="create" />
            <div className="flex flex-col gap-1.5 max-w-md">
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
            <div className="flex justify-end">
              <Button type="submit" variant="pop">
                Token erzeugen
              </Button>
            </div>
          </form>

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
              {tokens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-fg-4 italic py-5">
                    Noch keine Tokens.
                  </TableCell>
                </TableRow>
              ) : (
                tokens.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-semibold text-fg">{t.label}</div>
                      <div className="text-[11px] text-fg-4 [font-family:var(--font-mono)]">{t.prefix}…</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {t.scopes.map((s) => (
                          <Badge key={s}>{s}</Badge>
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
                      {!t.revoked && (
                        <Button variant="outline" size="sm" onClick={() => setRevoke({ kind: "token", id: t.id, label: t.label })}>
                          <Trash2 /> Widerrufen
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Brain-Mitglieder ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-fg-3" /> Brain-Mitglieder
          </CardTitle>
          <CardDescription>
            Lade jemanden ein, das AI-Brain unter /brain zu lesen. „Voll“ = alle Bereiche (ausser Secrets), „Nur Bereiche“ =
            nur die ausgewählten Ordner. Die Person meldet sich danach selbst per Magic-Link unter /brain/login an.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <form method="POST" action="/admin/brain-invite" className="flex flex-col gap-4">
            <input type="hidden" name="action" value="invite" />
            <div className="flex flex-wrap gap-3.5">
              <div className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
                <Label htmlFor="bm-email">Email</Label>
                <Input id="bm-email" type="email" name="email" required placeholder="person@example.com" />
              </div>
              <div className="flex flex-col gap-1.5 w-[200px]">
                <Label htmlFor="bm-clearance">Clearance</Label>
                <select id="bm-clearance" name="clearance" className={selectCls} defaultValue="brain">
                  <option value="brain">Nur Bereiche</option>
                  <option value="full">Voll (alle Ordner)</option>
                </select>
              </div>
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
            <div className="flex justify-end">
              <Button type="submit" variant="pop">
                <UserPlus /> Zugang erstellen
              </Button>
            </div>
          </form>

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
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-fg-4 italic py-5">
                    Noch keine Brain-Mitglieder.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => (
                  <TableRow key={m.email}>
                    <TableCell>
                      <div className="font-semibold text-fg">{m.email}</div>
                      <div className="text-[11px] text-fg-4">{m.scope}</div>
                    </TableCell>
                    <TableCell>
                      {m.clearance === "full" ? (
                        <Badge>voll</Badge>
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
                        <Button variant="outline" size="sm" onClick={() => setRevoke({ kind: "member", email: m.email })}>
                          <Trash2 /> Entziehen
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Revoke confirm (tokens + members share one dialog) */}
      <AlertDialog open={revoke !== null} onOpenChange={(o) => !o && setRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{revoke?.kind === "token" ? "Token widerrufen?" : "Brain-Zugang entziehen?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {revoke?.kind === "token"
                ? `„${revoke.label}" wird sofort ungültig. Geräte/Agents mit diesem Token verlieren den Zugriff.`
                : revoke?.kind === "member"
                  ? `${revoke.email} verliert den Zugriff auf /brain. Re-Einladen stellt ihn wieder her.`
                  : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form method="POST" action={revoke?.kind === "token" ? "/admin/tokens" : "/admin/brain-invite"}>
            <input type="hidden" name="action" value="revoke" />
            {revoke?.kind === "token" ? (
              <input type="hidden" name="id" value={revoke.id} />
            ) : (
              <input type="hidden" name="email" value={revoke?.kind === "member" ? revoke.email : ""} />
            )}
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="ghost">
                  Abbrechen
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button type="submit" variant="danger">
                  {revoke?.kind === "token" ? "Widerrufen" : "Entziehen"}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
