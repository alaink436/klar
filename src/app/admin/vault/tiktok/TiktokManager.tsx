"use client";

// TikTok channel logins: list, add, edit, delete, reveal password. Built like
// VaultManager (same shadcn/ui kit, same reveal flow): the password is fetched
// on click and cleared the moment the dialog closes.

import { useState } from "react";
import { Copy, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TextureCard } from "@/components/ui/texture-card";
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
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AdminLang } from "../../_i18n";

export interface TiktokRow {
  id: string;
  channel: string;
  username: string;
  email: string;
  note: string;
  hasPassword: boolean;
  updated: string;
}

const COPY = {
  de: {
    search: "Kanal, Benutzername oder E-Mail …",
    add: "Kanal hinzufügen",
    addTitle: "TikTok-Kanal hinzufügen",
    addBody: "Das Passwort wird server-seitig verschlüsselt (wie die API-Keys). Benutzername und E-Mail stehen im Klartext in der Liste.",
    editTitle: "Kanal bearbeiten",
    editBody: "Passwort-Feld leer lassen = das gespeicherte bleibt.",
    channel: "Kanal",
    username: "Benutzername",
    email: "Verbundene E-Mail",
    password: "Passwort",
    passwordKeep: "Neues Passwort (leer = bleibt)",
    note: "Notiz (Telefon, 2FA, …)",
    colPassword: "Passwort",
    colUpdated: "Geändert",
    show: "Anzeigen",
    none: "—",
    save: "Speichern",
    cancel: "Abbrechen",
    close: "Schließen",
    copy: "Kopieren",
    copied: "✓ Kopiert",
    revealTitle: (c: string) => `Passwort — ${c}`,
    revealLoading: "Entschlüssele…",
    revealError: (s: number) => `Fehler ${s}`,
    deleteTitle: "Kanal löschen?",
    deleteBody: (c: string) => `„${c}“ samt Passwort wird endgültig gelöscht.`,
    deleteSubmit: "Endgültig löschen",
    emptyTitle: "Noch keine Kanäle",
    emptyBody: "Leg den ersten TikTok-Kanal mit Benutzername, Passwort und E-Mail an.",
    noHits: (q: string) => `Nichts gefunden für „${q}“`,
  },
  en: {
    search: "Channel, username or e-mail …",
    add: "Add channel",
    addTitle: "Add TikTok channel",
    addBody: "The password is encrypted server-side (like the API keys). Username and e-mail are listed in clear.",
    editTitle: "Edit channel",
    editBody: "Leave the password empty to keep the stored one.",
    channel: "Channel",
    username: "Username",
    email: "Linked e-mail",
    password: "Password",
    passwordKeep: "New password (empty = keep)",
    note: "Note (phone, 2FA, …)",
    colPassword: "Password",
    colUpdated: "Changed",
    show: "Show",
    none: "—",
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    copy: "Copy",
    copied: "✓ Copied",
    revealTitle: (c: string) => `Password — ${c}`,
    revealLoading: "Decrypting…",
    revealError: (s: number) => `Error ${s}`,
    deleteTitle: "Delete channel?",
    deleteBody: (c: string) => `“${c}” and its password will be deleted for good.`,
    deleteSubmit: "Delete permanently",
    emptyTitle: "No channels yet",
    emptyBody: "Add the first TikTok channel with username, password and e-mail.",
    noHits: (q: string) => `Nothing found for “${q}”`,
  },
};

// Ab lg eigene Spalten; darunter (Handy) stehen Benutzername, E-Mail,
// Passwort und Datum unter dem Kanal.
const BREIT = "hidden lg:table-cell";

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  required,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const id = `tt-${name}`;
  return (
    <div className="flex flex-col gap-1.5 mb-3">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type={type} defaultValue={defaultValue} required={required} placeholder={placeholder} />
    </div>
  );
}

function AccountFields({ row, t }: { row?: TiktokRow; t: (typeof COPY)["de"] }) {
  return (
    <>
      <Field name="channel" label={t.channel} defaultValue={row?.channel} required placeholder="Kelva" />
      <Field name="username" label={t.username} defaultValue={row?.username} required placeholder="kelvaapp" />
      <Field name="email" label={t.email} type="email" defaultValue={row?.email} placeholder="kelva@gmail.com" />
      {/* new-password keeps the browser from autofilling the admin login here */}
      <div className="flex flex-col gap-1.5 mb-3">
        <Label htmlFor="tt-password">{row ? t.passwordKeep : t.password}</Label>
        <Input id="tt-password" name="password" type="password" autoComplete="new-password" />
      </div>
      <Field name="note" label={t.note} defaultValue={row?.note} />
    </>
  );
}

export default function TiktokManager({ rows, lang }: { rows: TiktokRow[]; lang: AdminLang }) {
  const t = COPY[lang];
  const [query, setQuery] = useState("");
  const [editRow, setEditRow] = useState<TiktokRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<TiktokRow | null>(null);
  const [revealRow, setRevealRow] = useState<TiktokRow | null>(null);
  const [reveal, setReveal] = useState<{ loading: boolean; pw: string | null; error: string | null }>({
    loading: false,
    pw: null,
    error: null,
  });
  const [copied, setCopied] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) => [r.channel, r.username, r.email, r.note].some((v) => v.toLowerCase().includes(q)))
    : rows;

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(key);
        setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400);
      },
      () => {},
    );
  }

  function openReveal(r: TiktokRow) {
    setRevealRow(r);
    setReveal({ loading: true, pw: null, error: null });
    const fd = new FormData();
    fd.set("id", r.id);
    fetch("/admin/vault/tiktok/reveal", { method: "POST", body: fd })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { password?: string; error?: string };
        if (!res.ok || typeof data.password !== "string") {
          setReveal({ loading: false, pw: null, error: data.error || t.revealError(res.status) });
        } else {
          setReveal({ loading: false, pw: data.password, error: null });
        }
      })
      .catch(() => setReveal({ loading: false, pw: null, error: t.revealError(0) }));
  }

  function closeReveal() {
    setRevealRow(null);
    setReveal({ loading: false, pw: null, error: null });
  }

  function copyCell(value: string, k: string) {
    if (!value) return <span className="text-fg-4">{t.none}</span>;
    return (
      <button
        type="button"
        onClick={() => copy(value, k)}
        className="inline-flex items-center gap-1.5 text-fg hover:text-fg-2 [font-family:var(--font-mono)] text-[12.5px] break-all text-left"
        title={t.copy}
      >
        {copied === k ? t.copied : value}
        <Copy className="size-3 shrink-0 text-fg-4" />
      </button>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-fg-4 pointer-events-none" />
          <Input
            type="search"
            placeholder={t.search}
            aria-label={t.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 rounded-full py-0 pl-9 text-[13px]"
          />
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="pill">
              <Plus /> {t.add}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.addTitle}</DialogTitle>
              <DialogDescription>{t.addBody}</DialogDescription>
            </DialogHeader>
            <form method="POST" action="/admin/vault/tiktok/save" autoComplete="off">
              <input type="hidden" name="action" value="add" />
              <AccountFields t={t} />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="pill-dark">
                    {t.cancel}
                  </Button>
                </DialogClose>
                <Button type="submit" variant="pill">{t.save}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {rows.length === 0 || filtered.length === 0 ? (
        <TextureCard className="flex flex-col items-center justify-center gap-2 text-center px-6 py-10 text-fg-3">
          <div className="text-sm font-medium text-fg">
            {rows.length === 0 ? t.emptyTitle : t.noHits(query.trim())}
          </div>
          {rows.length === 0 && <div className="text-[13px] text-fg-3 max-w-[42ch] leading-relaxed">{t.emptyBody}</div>}
        </TextureCard>
      ) : (
        // Die Karte traegt Kante und Grund, die Tabelle darin steht ohne eigenen Rahmen.
        <TextureCard>
          <Table className="rounded-none border-0 bg-transparent [&_th]:bg-transparent [&_th]:pt-3.5 lg:[&_td]:align-middle">
            <TableHeader>
              <TableRow>
                <TableHead>{t.channel}</TableHead>
                <TableHead className={BREIT}>{t.username}</TableHead>
                <TableHead className={BREIT}>{t.email}</TableHead>
                <TableHead className={BREIT}>{t.colPassword}</TableHead>
                <TableHead className={`${BREIT} text-right`}>{t.colUpdated}</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const passwort = r.hasPassword ? (
                  <Button variant="pill-dark" size="sm" onClick={() => openReveal(r)}>
                    <Eye /> {t.show}
                  </Button>
                ) : (
                  <span className="text-fg-4">{t.none}</span>
                );
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium text-fg">{r.channel}</div>
                      {r.note && <div className="text-[11px] text-fg-4">{r.note}</div>}
                      {/* Unter lg dieselben Angaben als Zeilen unter dem Kanal. */}
                      <div className="mt-2.5 flex flex-col items-start gap-1.5 lg:hidden">
                        {copyCell(r.username, `${r.id}:u`)}
                        {copyCell(r.email, `${r.id}:e`)}
                        <div className="flex items-center gap-3 text-[12px] text-fg-3">
                          {passwort}
                          {r.updated}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={BREIT}>
                      {copyCell(r.username, `${r.id}:u`)}
                    </TableCell>
                    <TableCell className={BREIT}>
                      {copyCell(r.email, `${r.id}:e`)}
                    </TableCell>
                    <TableCell className={BREIT}>{passwort}</TableCell>
                    <TableCell className={`${BREIT} text-right text-fg-3`}>{r.updated}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="pill-dark" size="icon" aria-label={t.editTitle} onClick={() => setEditRow(r)}>
                          <Pencil />
                        </Button>
                        <Button variant="pill-dark" size="icon" aria-label={t.deleteTitle} onClick={() => setDeleteRow(r)}>
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TextureCard>
      )}

      {/* Edit */}
      <Dialog open={editRow !== null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.editTitle}</DialogTitle>
            <DialogDescription>{t.editBody}</DialogDescription>
          </DialogHeader>
          {editRow && (
            <form key={editRow.id} method="POST" action="/admin/vault/tiktok/save" autoComplete="off">
              <input type="hidden" name="action" value="edit" />
              <input type="hidden" name="id" value={editRow.id} />
              <AccountFields row={editRow} t={t} />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="pill-dark">
                    {t.cancel}
                  </Button>
                </DialogClose>
                <Button type="submit" variant="pill">{t.save}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Reveal password */}
      <Dialog open={revealRow !== null} onOpenChange={(o) => !o && closeReveal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.revealTitle(revealRow?.channel ?? "")}</DialogTitle>
            <DialogDescription>@{revealRow?.username}</DialogDescription>
          </DialogHeader>
          {reveal.loading ? (
            <p className="text-fg-3 text-sm">{t.revealLoading}</p>
          ) : reveal.error ? (
            <p className="text-danger text-sm">{reveal.error}</p>
          ) : (
            <>
              <code className="block [font-family:var(--font-mono)] text-[13px] bg-black/40 border border-line rounded-[var(--radius-sm)] px-4 py-3.5 text-fg break-all leading-relaxed">
                {reveal.pw}
              </code>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="pill-dark">
                    {t.close}
                  </Button>
                </DialogClose>
                <Button type="button" variant="pill" onClick={() => reveal.pw && copy(reveal.pw, "pw")}>
                  {copied === "pw" ? t.copied : t.copy}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm — plain submit button, see VaultManager for why not AlertDialogAction */}
      <AlertDialog open={deleteRow !== null} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteBody(deleteRow?.channel ?? "")}</AlertDialogDescription>
          </AlertDialogHeader>
          <form method="POST" action="/admin/vault/tiktok/save">
            <input type="hidden" name="action" value="delete" />
            <input type="hidden" name="id" value={deleteRow?.id ?? ""} />
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="pill-dark">
                  {t.cancel}
                </Button>
              </AlertDialogCancel>
              <Button type="submit" variant="pill-dark" className="text-danger">
                {t.deleteSubmit}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
