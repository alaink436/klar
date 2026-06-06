"use client";

// Vault management UI, built on the shadcn/ui kit (src/components/ui/*) which is
// themed to the admin tokens. Plaintext keys are never shown except the explicit
// "reveal" dialog (admin-only, fetched on demand and cleared on close).

import { useState, type ComponentProps } from "react";
import { MoreHorizontal, Copy, Eye, RefreshCw, Trash2, Plus, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export interface VaultRow {
  id: string;
  label: string;
  provider: string;
  baseUrl: string;
  proxy: string;
  lastUsed: string;
}

function Field({
  name,
  label,
  className,
  ...props
}: ComponentProps<typeof Input> & { label: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}

// The metadata + key fields for the add form; rotate reuses only the key field.
function KeyFields({ includeMeta }: { includeMeta: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3.5">
      {includeMeta && (
        <>
          <Field name="label" label="Label" required placeholder="z.B. OpenAI Prod" />
          <Field name="provider" label="Provider" placeholder="openai" />
          <Field name="base_url" label="Base-URL" type="url" required placeholder="https://api.openai.com" className="col-span-2" />
          <Field name="auth_header" label="Auth-Header" defaultValue="authorization" />
          <Field name="auth_scheme" label="Schema-Prefix" defaultValue="Bearer " />
        </>
      )}
      <Field
        name="secret"
        label="API-Key (wird verschlüsselt, danach nicht mehr lesbar)"
        type="password"
        required
        autoComplete="new-password"
        placeholder="sk-…"
        className="col-span-2"
        style={{ fontFamily: "var(--font-mono)" }}
      />
    </div>
  );
}

export default function VaultManager({ rows }: { rows: VaultRow[] }) {
  const [rotateRow, setRotateRow] = useState<VaultRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<VaultRow | null>(null);
  const [revealRow, setRevealRow] = useState<VaultRow | null>(null);
  const [reveal, setReveal] = useState<{ loading: boolean; key: string | null; error: string | null }>({
    loading: false,
    key: null,
    error: null,
  });
  const [revealCopied, setRevealCopied] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Reveal: fetch the plaintext on demand from the click handler (not an effect),
  // and clear it the moment the dialog closes so it never lingers in memory.
  function openReveal(r: VaultRow) {
    setRevealRow(r);
    setRevealCopied(false);
    setReveal({ loading: true, key: null, error: null });
    const fd = new FormData();
    fd.set("id", r.id);
    fetch("/admin/vault/reveal", { method: "POST", body: fd })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { key?: string; error?: string };
        if (!res.ok || typeof data.key !== "string") {
          setReveal({ loading: false, key: null, error: data.error || `Fehler ${res.status}` });
        } else {
          setReveal({ loading: false, key: data.key, error: null });
        }
      })
      .catch(() => setReveal({ loading: false, key: null, error: "Netzwerkfehler" }));
  }

  function closeReveal() {
    setRevealRow(null);
    setReveal({ loading: false, key: null, error: null });
    setRevealCopied(false);
  }

  function copyProxy(r: VaultRow) {
    navigator.clipboard.writeText(r.proxy).then(
      () => {
        setCopiedId(r.id);
        setTimeout(() => setCopiedId((c) => (c === r.id ? null : c)), 1400);
      },
      () => {},
    );
  }

  return (
    <>
      {/* Add key */}
      <div className="flex justify-end mb-3.5">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="pop">
              <Plus /> Key hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>API-Key hinzufügen</DialogTitle>
              <DialogDescription>
                Wird server-seitig AES-256-GCM verschlüsselt. Nur über den Proxy nutzbar, der Klartext ist danach nicht mehr abrufbar.
              </DialogDescription>
            </DialogHeader>
            <form method="POST" action="/admin/vault/save" autoComplete="off">
              <input type="hidden" name="action" value="add" />
              <KeyFields includeMeta />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Abbrechen
                  </Button>
                </DialogClose>
                <Button type="submit">Verschlüsselt speichern</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 text-center px-6 py-10 border border-dashed border-line-strong rounded-[var(--radius)] bg-surface text-fg-3">
          <KeyRound className="size-7 text-fg-4 mb-0.5" strokeWidth={1.5} />
          <div className="[font-family:var(--font-body)] font-semibold text-sm text-fg-2">Noch keine Keys im Vault</div>
          <div className="text-[13px] text-fg-3 max-w-[42ch] leading-relaxed">
            Über „Key hinzufügen“ einen API-Key ablegen. Er wird verschlüsselt und ist danach nur über den Proxy nutzbar.
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Proxy-URL</TableHead>
              <TableHead className="text-right">Zuletzt</TableHead>
              <TableHead className="w-px" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-semibold text-fg">{r.label}</div>
                  <div className="text-[11px] text-fg-4 [font-family:var(--font-mono)]">
                    {r.provider} · {r.baseUrl}
                  </div>
                </TableCell>
                <TableCell>
                  <code className="[font-family:var(--font-mono)] text-[11px] text-fg-3 break-all">{r.proxy}…</code>
                </TableCell>
                <TableCell className="text-right text-fg-3">{r.lastUsed}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" aria-label="Aktionen">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          copyProxy(r);
                        }}
                      >
                        <Copy /> {copiedId === r.id ? "Kopiert ✓" : "Proxy-URL kopieren"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openReveal(r)}>
                        <Eye /> Key anzeigen
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setRotateRow(r)}>
                        <RefreshCw /> Key rotieren
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem danger onSelect={() => setDeleteRow(r)}>
                        <Trash2 /> Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Rotate */}
      <Dialog open={rotateRow !== null} onOpenChange={(o) => !o && setRotateRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Key rotieren</DialogTitle>
            <DialogDescription>
              Neuer Key für „{rotateRow?.label}“. Der alte wird ersetzt; die Proxy-URL bleibt gleich.
            </DialogDescription>
          </DialogHeader>
          <form method="POST" action="/admin/vault/save" autoComplete="off">
            <input type="hidden" name="action" value="rotate" />
            <input type="hidden" name="id" value={rotateRow?.id ?? ""} />
            <KeyFields includeMeta={false} />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Abbrechen
                </Button>
              </DialogClose>
              <Button type="submit">Rotieren</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reveal (read the plaintext back — admin only) */}
      <Dialog open={revealRow !== null} onOpenChange={(o) => !o && closeReveal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Key anzeigen — {revealRow?.label}</DialogTitle>
            <DialogDescription>Klartext, nur für dich (Admin). Kopier ihn und schließe das Fenster wieder.</DialogDescription>
          </DialogHeader>
          {reveal.loading ? (
            <p className="text-fg-3 text-sm">Entschlüssele…</p>
          ) : reveal.error ? (
            <p className="text-danger text-sm">{reveal.error}</p>
          ) : (
            <>
              <code className="block [font-family:var(--font-mono)] text-[13px] bg-surface-2 border border-line-strong rounded-[var(--radius-sm)] px-4 py-3.5 text-fg break-all leading-relaxed">
                {reveal.key}
              </code>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Schließen
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  onClick={() => {
                    if (reveal.key) {
                      navigator.clipboard.writeText(reveal.key).then(
                        () => {
                          setRevealCopied(true);
                          setTimeout(() => setRevealCopied(false), 1400);
                        },
                        () => {},
                      );
                    }
                  }}
                >
                  {revealCopied ? "✓ Kopiert" : "Key kopieren"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteRow !== null} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vault-Key löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteRow?.label}“ wird endgültig gelöscht. Agents mit dieser Proxy-URL verlieren den Zugriff. Das lässt sich nicht rückgängig machen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form method="POST" action="/admin/vault/save">
            <input type="hidden" name="action" value="delete" />
            <input type="hidden" name="id" value={deleteRow?.id ?? ""} />
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="ghost">
                  Abbrechen
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button type="submit" variant="danger">
                  Endgültig löschen
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
