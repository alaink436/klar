"use client";

// Vault management UI, built on the shadcn/ui kit (src/components/ui/*) which is
// themed to the admin tokens. Plaintext keys are never shown except the explicit
// "reveal" dialog (admin-only, fetched on demand and cleared on close).

import { useState, type ComponentProps } from "react";
import { MoreHorizontal, Copy, Eye, Pencil, RefreshCw, Trash2, Plus, KeyRound } from "lucide-react";
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
  category: string;
  baseUrl: string;
  authHeader: string;
  authScheme: string;
  proxy: string; // "" for store-only secrets (no base_url -> not proxyable)
  lastUsed: string;
}

// Suggested categories shown in the add form's datalist. Free text: the admin
// can also type a category that isn't in this list.
const CATEGORY_SUGGESTIONS = [
  "KI / LLM",
  "Datenbank",
  "RevenueCat",
  "Payment",
  "Email",
  "Resend",
  "Automation",
  "Social / Marketing",
  "Mobile / Stores",
  "Infrastruktur",
  "Sonstiges",
];

// Per-category examples. The point is that each kind of key looks genuinely
// different (a Supabase JWT vs a Stripe sk_live_ vs an Apple .p8), so the add
// form shows a fitting, distinct example for the chosen category.
//   baseUrl     – hint text shown as the Base-URL placeholder
//   baseUrlFill – the value actually inserted into the field on category pick;
//                 "" = leave empty (store-only, or account-specific so there is
//                 no single correct URL to prefill)
interface CategoryExample {
  label: string;
  provider: string;
  baseUrl: string;
  baseUrlFill: string;
  key: string;
}
const DEFAULT_EXAMPLE: CategoryExample = {
  label: "Mein Service",
  provider: "custom",
  baseUrl: "https://api.example.com  ·  leer = nur speichern",
  baseUrlFill: "",
  key: "Key / Token …",
};
const CATEGORY_EXAMPLES: Record<string, CategoryExample> = {
  "KI / LLM": { label: "OpenAI Prod", provider: "openai", baseUrl: "https://api.openai.com", baseUrlFill: "https://api.openai.com", key: "sk-proj-…  /  sk-ant-…" },
  Datenbank: { label: "Supabase Service Role – Klar", provider: "supabase", baseUrl: "leer lassen = nur speichern (Service Role)", baseUrlFill: "", key: "eyJhbGci… (JWT)  /  sb_secret_…" },
  RevenueCat: { label: "RevenueCat – MyLoo (iOS)", provider: "revenuecat", baseUrl: "https://api.revenuecat.com", baseUrlFill: "https://api.revenuecat.com", key: "sk_… (secret)  /  appl_… (public)" },
  Payment: { label: "Stripe Live", provider: "stripe", baseUrl: "https://api.stripe.com", baseUrlFill: "https://api.stripe.com", key: "sk_live_…" },
  Email: { label: "Brevo Transaktional", provider: "brevo", baseUrl: "https://api.brevo.com/v3", baseUrlFill: "https://api.brevo.com/v3", key: "xkeysib-…" },
  Resend: { label: "Resend – Transaktional", provider: "resend", baseUrl: "https://api.resend.com", baseUrlFill: "https://api.resend.com", key: "re_…" },
  Automation: { label: "n8n Cloud API", provider: "n8n", baseUrl: "https://<konto>.app.n8n.cloud/api/v1", baseUrlFill: "", key: "eyJ… (JWT)" },
  "Social / Marketing": { label: "Blotato", provider: "blotato", baseUrl: "https://backend.blotato.com", baseUrlFill: "https://backend.blotato.com", key: "Blotato API-Key" },
  "Mobile / Stores": { label: "App Store Connect API", provider: "apple", baseUrl: "leer lassen = nur speichern (.p8 / JSON)", baseUrlFill: "", key: "-----BEGIN PRIVATE KEY----- (.p8)" },
  Infrastruktur: { label: "Vercel Token", provider: "vercel", baseUrl: "https://api.vercel.com", baseUrlFill: "https://api.vercel.com", key: "Bearer-Token …" },
  Sonstiges: DEFAULT_EXAMPLE,
};

function exampleFor(category: string): CategoryExample {
  return CATEGORY_EXAMPLES[category.trim()] ?? DEFAULT_EXAMPLE;
}

// Group rows by category, ordered by the suggestion list, then custom
// categories alphabetically, with "Sonstiges" always last.
function groupByCategory(rows: VaultRow[]): Array<{ category: string; rows: VaultRow[] }> {
  const map = new Map<string, VaultRow[]>();
  for (const r of rows) {
    const c = r.category || "Sonstiges";
    const bucket = map.get(c);
    if (bucket) bucket.push(r);
    else map.set(c, [r]);
  }
  const rank = (c: string) => {
    if (c === "Sonstiges") return 1000;
    const i = CATEGORY_SUGGESTIONS.indexOf(c);
    return i === -1 ? 500 : i;
  };
  return [...map.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], "de"))
    .map(([category, rs]) => ({ category, rows: rs }));
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
// When a category is picked, every placeholder switches to a fitting example for
// that category so the examples stay sensible and distinct from one another.
function KeyFields({ includeMeta }: { includeMeta: boolean }) {
  const [category, setCategory] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const ex = exampleFor(category);

  // On an exact category match, prefill the canonical Base-URL (empty for
  // store-only / account-specific categories). Typing a not-yet-matching or
  // custom category leaves whatever is already in the field untouched.
  function pickCategory(value: string) {
    setCategory(value);
    const known = CATEGORY_EXAMPLES[value.trim()];
    if (known) setBaseUrl(known.baseUrlFill);
  }

  return (
    <div className="grid grid-cols-2 gap-3.5">
      {includeMeta && (
        <>
          <Field name="label" label="Label" required placeholder={`z.B. ${ex.label}`} />
          <Field
            name="category"
            label="Kategorie"
            list="vault-categories"
            autoComplete="off"
            placeholder="z.B. Datenbank"
            value={category}
            onChange={(e) => pickCategory(e.target.value)}
          />
          <datalist id="vault-categories">
            {CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Field name="provider" label="Provider" placeholder={`z.B. ${ex.provider}`} />
          <Field name="auth_header" label="Auth-Header" defaultValue="authorization" />
          <Field
            name="base_url"
            label="Base-URL — leer lassen = nur speichern (kein Proxy)"
            type="url"
            placeholder={ex.baseUrl}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="col-span-2"
          />
          <Field name="auth_scheme" label="Schema-Prefix" defaultValue="Bearer " className="col-span-2" />
        </>
      )}
      <div className="col-span-2 flex flex-col gap-1.5">
        <Label htmlFor="secret">API-Key (wird verschlüsselt, danach nicht mehr lesbar)</Label>
        <Input
          id="secret"
          name="secret"
          type="password"
          required
          autoComplete="new-password"
          placeholder={includeMeta ? ex.key : "neuer Key …"}
          style={{ fontFamily: "var(--font-mono)" }}
        />
        {includeMeta && (
          <p className="text-[11px] text-fg-4">
            Beispiel für {category.trim() || "diese Kategorie"}:{" "}
            <code className="[font-family:var(--font-mono)]">{ex.key}</code>
          </p>
        )}
      </div>
    </div>
  );
}

// Pre-filled metadata fields for the edit dialog (no key field — the stored key
// is never touched here). Uncontrolled defaults; the form is remounted per row
// (key={editRow.id}) so the defaults always reflect the row being edited.
function MetaFields({ row }: { row: VaultRow }) {
  return (
    <div className="grid grid-cols-2 gap-3.5">
      <Field name="label" label="Label" required defaultValue={row.label} />
      <Field
        name="category"
        label="Kategorie"
        list="vault-categories-edit"
        autoComplete="off"
        placeholder="z.B. Datenbank"
        defaultValue={row.category === "Sonstiges" ? "" : row.category}
      />
      <datalist id="vault-categories-edit">
        {CATEGORY_SUGGESTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <Field name="provider" label="Provider" defaultValue={row.provider} />
      <Field name="auth_header" label="Auth-Header" defaultValue={row.authHeader || "authorization"} />
      <Field
        name="base_url"
        label="Base-URL — leer lassen = nur speichern (kein Proxy)"
        type="url"
        placeholder="https://api.example.com"
        defaultValue={row.baseUrl}
        className="col-span-2"
      />
      <Field name="auth_scheme" label="Schema-Prefix" defaultValue={row.authScheme || "Bearer "} className="col-span-2" />
    </div>
  );
}

export default function VaultManager({ rows }: { rows: VaultRow[] }) {
  const [rotateRow, setRotateRow] = useState<VaultRow | null>(null);
  const [editRow, setEditRow] = useState<VaultRow | null>(null);
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

  function renderRow(r: VaultRow) {
    return (
      <TableRow key={r.id}>
        <TableCell>
          <div className="font-semibold text-fg">{r.label}</div>
          <div className="text-[11px] text-fg-4 [font-family:var(--font-mono)]">
            {r.provider}
            {r.baseUrl ? ` · ${r.baseUrl}` : ""}
          </div>
        </TableCell>
        <TableCell>
          {r.proxy ? (
            <code className="[font-family:var(--font-mono)] text-[11px] text-fg-3 break-all">{r.proxy}…</code>
          ) : (
            <span className="text-[11px] text-fg-4">Store-only · kein Proxy</span>
          )}
        </TableCell>
        <TableCell className="text-right text-fg-3">{r.lastUsed}</TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => openReveal(r)}>
              <Eye /> Key anzeigen
            </Button>
            {/* modal={false}: a modal dropdown locks body pointer-events while
                open and, when an item opens a Dialog/AlertDialog, leaves
                `pointer-events: none` stuck on <body> — freezing every control
                inside that dialog (the rotate/delete buttons would not respond).
                Non-modal here avoids that; the dialogs are modal themselves. */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Weitere Aktionen">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {r.proxy && (
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      copyProxy(r);
                    }}
                  >
                    <Copy /> {copiedId === r.id ? "Kopiert ✓" : "Proxy-URL kopieren"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setEditRow(r)}>
                  <Pencil /> Bearbeiten
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
          </div>
        </TableCell>
      </TableRow>
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
                Wird server-seitig AES-256-GCM verschlüsselt. Mit Base-URL über den Proxy nutzbar; ohne Base-URL nur gespeichert und per „Key anzeigen“ abrufbar.
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
            Über „Key hinzufügen“ einen Key ablegen — mit Kategorie. Mit Base-URL über den Proxy nutzbar, ohne nur zum späteren Anzeigen.
          </div>
        </div>
      ) : (
        groupByCategory(rows).map(({ category, rows: catRows }) => (
          <section key={category} className="mb-7 last:mb-0">
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="[font-family:var(--font-mono)] text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-2">
                {category}
              </h2>
              <span className="text-[11px] text-fg-4">{catRows.length}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Proxy-URL</TableHead>
                  <TableHead className="text-right">Zuletzt</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>{catRows.map(renderRow)}</TableBody>
            </Table>
          </section>
        ))
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

      {/* Edit metadata (label / category / provider / routing) — key untouched */}
      <Dialog open={editRow !== null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eintrag bearbeiten</DialogTitle>
            <DialogDescription>
              Metadaten von „{editRow?.label}“ ändern. Der gespeicherte Key bleibt unverändert (zum Ersetzen „Key rotieren“). Base-URL leeren = nur speichern, kein Proxy; die Proxy-URL/ID bleibt gleich.
            </DialogDescription>
          </DialogHeader>
          {editRow && (
            <form key={editRow.id} method="POST" action="/admin/vault/save" autoComplete="off">
              <input type="hidden" name="action" value="edit" />
              <input type="hidden" name="id" value={editRow.id} />
              <MetaFields row={editRow} />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Abbrechen
                  </Button>
                </DialogClose>
                <Button type="submit">Speichern</Button>
              </DialogFooter>
            </form>
          )}
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
