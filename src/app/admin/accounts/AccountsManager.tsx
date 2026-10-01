"use client";

// Account register UI (/admin/accounts). Same kit and the same rules as the
// VaultManager next door: forms post straight to the save route, a password is
// only ever fetched on an explicit "show" click through the vault's own reveal
// route and is cleared when the dialog closes.

import { useState } from "react";
import { Copy, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import type { AdminLang } from "../_i18n";

export interface AccountRow {
  id: string;
  app: string;
  appName: string;
  platform: string;
  handle: string;
  displayName: string;
  role: string;
  status: string;
  loginEmail: string;
  passwordSecretId: string;
  notes: string;
  /** Blotato account id when Blotato currently has this account connected. */
  blotatoId: string;
}

const COPY = {
  de: {
    search: "Konto, App oder Login suchen",
    add: "Konto hinzufügen",
    account: "Konto",
    login: "Login",
    password: "Passwort",
    blotato: "Blotato",
    status: "Status",
    show: "Anzeigen",
    setPassword: "Setzen",
    none: "—",
    connected: "verbunden",
    notConnected: "nicht verbunden",
    edit: "Bearbeiten",
    del: "Löschen",
    copy: "Kopieren",
    copied: "Kopiert",
    save: "Speichern",
    cancel: "Abbrechen",
    newTitle: "Neues Konto",
    editTitle: "Konto bearbeiten",
    formHint: "Das Passwort wird verschlüsselt im Vault abgelegt. Leer lassen, um es nicht zu ändern.",
    fApp: "App",
    fPlatform: "Plattform",
    fHandle: "Handle",
    fDisplay: "Anzeigename",
    fRole: "Rolle",
    fStatus: "Status",
    fLogin: "Login (E-Mail / Benutzer)",
    fPassword: "Passwort",
    fNotes: "Notiz",
    revealTitle: "Passwort",
    revealLoading: "Wird entschlüsselt …",
    revealError: "Konnte nicht gelesen werden",
    deleteTitle: "Konto löschen?",
    deleteBody: "Das Konto und sein gespeichertes Passwort werden endgültig gelöscht.",
    deleteSubmit: "Endgültig löschen",
    status_warmup: "Aufwärmen",
    status_active: "Aktiv",
    status_paused: "Ruht",
    role_brand: "Brand",
    role_private: "Privat",
    role_legacy: "Alt",
    role_founder: "Founder",
    total: (n: number, linked: number, pw: number) => `${n} Konten · ${linked} in Blotato · ${pw} mit Passwort`,
  },
  en: {
    search: "Search account, app or login",
    add: "Add account",
    account: "Account",
    login: "Login",
    password: "Password",
    blotato: "Blotato",
    status: "Status",
    show: "Show",
    setPassword: "Set",
    none: "—",
    connected: "connected",
    notConnected: "not connected",
    edit: "Edit",
    del: "Delete",
    copy: "Copy",
    copied: "Copied",
    save: "Save",
    cancel: "Cancel",
    newTitle: "New account",
    editTitle: "Edit account",
    formHint: "The password is stored encrypted in the vault. Leave it empty to keep the current one.",
    fApp: "App",
    fPlatform: "Platform",
    fHandle: "Handle",
    fDisplay: "Display name",
    fRole: "Role",
    fStatus: "Status",
    fLogin: "Login (email / user)",
    fPassword: "Password",
    fNotes: "Note",
    revealTitle: "Password",
    revealLoading: "Decrypting …",
    revealError: "Could not be read",
    deleteTitle: "Delete account?",
    deleteBody: "The account and its stored password are deleted for good.",
    deleteSubmit: "Delete permanently",
    status_warmup: "Warming up",
    status_active: "Active",
    status_paused: "Paused",
    role_brand: "Brand",
    role_private: "Private",
    role_legacy: "Legacy",
    role_founder: "Founder",
    total: (n: number, linked: number, pw: number) => `${n} accounts · ${linked} in Blotato · ${pw} with password`,
  },
};

const PLATFORMS = ["tiktok", "instagram", "youtube", "x"];
const ROLES = ["brand", "private", "legacy", "founder"] as const;
const STATUSES = ["warmup", "active", "paused"] as const;
const PLATFORM_LABEL: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", x: "X" };

const selectCls =
  "h-9 w-full rounded-md border border-line bg-surface px-3 text-[13px] text-fg focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent)_40%,transparent)]";

export default function AccountsManager({
  rows,
  apps,
  lang,
}: {
  rows: AccountRow[];
  apps: { key: string; name: string }[];
  lang: AdminLang;
}) {
  const t = COPY[lang === "en" ? "en" : "de"];
  const [query, setQuery] = useState("");
  const [editRow, setEditRow] = useState<AccountRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteRow, setDeleteRow] = useState<AccountRow | null>(null);
  const [reveal, setReveal] = useState<{ row: AccountRow; key: string | null; error: string | null } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) =>
        [r.appName, r.platform, r.handle, r.displayName, r.loginEmail, r.notes].some((v) => v.toLowerCase().includes(q)),
      )
    : rows;
  const groups = apps
    .map((a) => ({ ...a, rows: filtered.filter((r) => r.app === a.key) }))
    .filter((g) => g.rows.length > 0);

  function copy(text: string, tag: string) {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(tag);
        setTimeout(() => setCopied((c) => (c === tag ? null : c)), 1400);
      },
      () => {},
    );
  }

  function openReveal(r: AccountRow) {
    setReveal({ row: r, key: null, error: null });
    const fd = new FormData();
    fd.set("id", r.passwordSecretId);
    fetch("/admin/vault/reveal", { method: "POST", body: fd })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { key?: string };
        setReveal((cur) =>
          cur && cur.row.id === r.id
            ? typeof data.key === "string"
              ? { ...cur, key: data.key }
              : { ...cur, error: t.revealError }
            : cur,
        );
      })
      .catch(() => setReveal((cur) => (cur ? { ...cur, error: t.revealError } : cur)));
  }

  const linked = rows.filter((r) => r.blotatoId).length;
  const withPw = rows.filter((r) => r.passwordSecretId).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-fg-4 pointer-events-none" />
          <Input className="pl-9" placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-fg-4">{t.total(rows.length, linked, withPw)}</span>
          <Button onClick={() => setAdding(true)}>
            <Plus /> {t.add}
          </Button>
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.key} className="mb-6">
          <div className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3 mb-2">
            {g.name}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.account}</TableHead>
                <TableHead>{t.login}</TableHead>
                <TableHead>{t.password}</TableHead>
                <TableHead>{t.blotato}</TableHead>
                <TableHead>{t.status}</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {g.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-semibold text-fg">{r.handle ? `@${r.handle}` : t.none}</div>
                    <div className="text-[11px] text-fg-4">
                      {PLATFORM_LABEL[r.platform] ?? r.platform} · {t[`role_${r.role}` as `role_${(typeof ROLES)[number]}`] ?? r.role}
                      {r.displayName ? ` · ${r.displayName}` : ""}
                    </div>
                    {r.notes && <div className="text-[11px] text-fg-3 mt-0.5 max-w-xs">{r.notes}</div>}
                  </TableCell>
                  <TableCell>
                    {r.loginEmail ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-[12px] text-fg-2 hover:text-fg [font-family:var(--font-mono)]"
                        onClick={() => copy(r.loginEmail, `login:${r.id}`)}
                        title={t.copy}
                      >
                        {r.loginEmail}
                        <Copy className="size-3.5 text-fg-4" />
                        {copied === `login:${r.id}` && <span className="text-fg-4 font-sans">{t.copied}</span>}
                      </button>
                    ) : (
                      <span className="text-fg-4">{t.none}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.passwordSecretId ? (
                      <Button variant="outline" size="sm" onClick={() => openReveal(r)}>
                        <Eye /> {t.show}
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setEditRow(r)}>
                        <Plus /> {t.setPassword}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge tone={r.blotatoId ? "ok" : "neutral"} dot>
                      {r.blotatoId ? `${t.connected} · ${r.blotatoId}` : t.notConnected}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge tone={r.status === "active" ? "ok" : r.status === "warmup" ? "warn" : "neutral"}>
                      {t[`status_${r.status}` as `status_${(typeof STATUSES)[number]}`] ?? r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="icon" aria-label={t.edit} onClick={() => setEditRow(r)}>
                        <Pencil />
                      </Button>
                      <Button variant="outline" size="icon" aria-label={t.del} onClick={() => setDeleteRow(r)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}

      {/* Add / edit share one form. */}
      <Dialog open={adding || editRow !== null} onOpenChange={(o) => !o && (setAdding(false), setEditRow(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editRow ? t.editTitle : t.newTitle}</DialogTitle>
            <DialogDescription>{t.formHint}</DialogDescription>
          </DialogHeader>
          <form method="post" action="/admin/accounts/save" className="grid grid-cols-2 gap-3.5" autoComplete="off">
            <input type="hidden" name="action" value={editRow ? "edit" : "add"} />
            {editRow && <input type="hidden" name="id" value={editRow.id} />}
            <div className="flex flex-col gap-1.5">
              <Label>{t.fApp}</Label>
              <select name="app" defaultValue={editRow?.app ?? apps[0]?.key} className={selectCls}>
                {apps.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t.fPlatform}</Label>
              <select name="platform" defaultValue={editRow?.platform ?? "tiktok"} className={selectCls}>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t.fHandle}</Label>
              <Input name="handle" defaultValue={editRow?.handle ?? ""} placeholder="@handle" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t.fDisplay}</Label>
              <Input name="display_name" defaultValue={editRow?.displayName ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t.fRole}</Label>
              <select name="role" defaultValue={editRow?.role ?? "private"} className={selectCls}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t[`role_${r}`]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t.fStatus}</Label>
              <select name="status" defaultValue={editRow?.status ?? "warmup"} className={selectCls}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t[`status_${s}`]}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>{t.fLogin}</Label>
              <Input name="login_email" defaultValue={editRow?.loginEmail ?? ""} />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>{t.fPassword}</Label>
              <Input name="password" type="password" autoComplete="new-password" />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>{t.fNotes}</Label>
              <Input name="notes" defaultValue={editRow?.notes ?? ""} />
            </div>
            <DialogFooter className="col-span-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t.cancel}
                </Button>
              </DialogClose>
              <Button type="submit">{t.save}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reveal: fetched on click, gone when the dialog closes. */}
      <Dialog open={reveal !== null} onOpenChange={(o) => !o && setReveal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t.revealTitle} · {reveal?.row.handle ? `@${reveal.row.handle}` : ""}
            </DialogTitle>
            <DialogDescription>{reveal?.row.loginEmail || ""}</DialogDescription>
          </DialogHeader>
          {reveal?.error ? (
            <p className="text-[13px] text-[var(--danger)]">{reveal.error}</p>
          ) : reveal?.key == null ? (
            <p className="text-[13px] text-fg-3">{t.revealLoading}</p>
          ) : (
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-md border border-line bg-surface-2 px-3 py-2 [font-family:var(--font-mono)] text-[13px]">
                {reveal.key}
              </code>
              <Button variant="outline" size="sm" onClick={() => copy(reveal.key ?? "", "reveal")}>
                <Copy /> {copied === "reveal" ? t.copied : t.copy}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteRow !== null} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.deleteTitle}</DialogTitle>
            <DialogDescription>{t.deleteBody}</DialogDescription>
          </DialogHeader>
          <form method="post" action="/admin/accounts/save">
            <input type="hidden" name="action" value="delete" />
            <input type="hidden" name="id" value={deleteRow?.id ?? ""} />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t.cancel}
                </Button>
              </DialogClose>
              <Button type="submit" variant="danger">
                {t.deleteSubmit}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
