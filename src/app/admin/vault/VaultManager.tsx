"use client";

// Vault management UI, built on the shadcn/ui kit (src/components/ui/*) which is
// themed to the admin tokens. Plaintext keys are never shown except the explicit
// "reveal" dialog (admin-only, fetched on demand and cleared on close).

import { useState, type ComponentProps } from "react";
import { MoreHorizontal, Copy, Eye, Pencil, RefreshCw, Trash2, Plus, KeyRound, Search } from "lucide-react";
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

// Known provider presets. Picking one auto-fills the base URL AND the correct
// auth header/scheme — these genuinely differ per provider: Anthropic uses
// `x-api-key` with no scheme prefix, Brevo/Postmark use their own header, most
// others a Bearer token on `authorization`. baseUrl "" = account-specific or
// store-only (no single correct URL), left for the user to fill in.
interface ProviderPreset {
  id: string;
  label: string;
  category: string; // matches a CATEGORY_SUGGESTIONS value (drives the filter)
  provider: string;
  baseUrl: string;
  authHeader: string;
  authScheme: string;
  keyExample: string;
  labelExample: string;
}
const PROVIDER_PRESETS: ProviderPreset[] = [
  // KI / LLM
  { id: "anthropic", label: "Anthropic (Claude)", category: "KI / LLM", provider: "anthropic", baseUrl: "https://api.anthropic.com", authHeader: "x-api-key", authScheme: "", keyExample: "sk-ant-…", labelExample: "Anthropic Prod" },
  { id: "openai", label: "OpenAI", category: "KI / LLM", provider: "openai", baseUrl: "https://api.openai.com", authHeader: "authorization", authScheme: "Bearer ", keyExample: "sk-proj-… / sk-…", labelExample: "OpenAI Prod" },
  { id: "gemini", label: "Google Gemini", category: "KI / LLM", provider: "google", baseUrl: "https://generativelanguage.googleapis.com", authHeader: "x-goog-api-key", authScheme: "", keyExample: "AIza…", labelExample: "Gemini" },
  { id: "mistral", label: "Mistral", category: "KI / LLM", provider: "mistral", baseUrl: "https://api.mistral.ai", authHeader: "authorization", authScheme: "Bearer ", keyExample: "API-Key …", labelExample: "Mistral" },
  { id: "groq", label: "Groq", category: "KI / LLM", provider: "groq", baseUrl: "https://api.groq.com/openai/v1", authHeader: "authorization", authScheme: "Bearer ", keyExample: "gsk_…", labelExample: "Groq" },
  { id: "openrouter", label: "OpenRouter", category: "KI / LLM", provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1", authHeader: "authorization", authScheme: "Bearer ", keyExample: "sk-or-…", labelExample: "OpenRouter" },
  { id: "perplexity", label: "Perplexity", category: "KI / LLM", provider: "perplexity", baseUrl: "https://api.perplexity.ai", authHeader: "authorization", authScheme: "Bearer ", keyExample: "pplx-…", labelExample: "Perplexity" },
  { id: "xai", label: "xAI (Grok)", category: "KI / LLM", provider: "xai", baseUrl: "https://api.x.ai", authHeader: "authorization", authScheme: "Bearer ", keyExample: "xai-…", labelExample: "xAI" },
  { id: "deepseek", label: "DeepSeek", category: "KI / LLM", provider: "deepseek", baseUrl: "https://api.deepseek.com", authHeader: "authorization", authScheme: "Bearer ", keyExample: "sk-…", labelExample: "DeepSeek" },
  // Datenbank
  { id: "supabase", label: "Supabase (Service Role)", category: "Datenbank", provider: "supabase", baseUrl: "", authHeader: "authorization", authScheme: "Bearer ", keyExample: "eyJ… (JWT) / sb_secret_…", labelExample: "Supabase Service Role" },
  // RevenueCat
  { id: "revenuecat", label: "RevenueCat (Secret)", category: "RevenueCat", provider: "revenuecat", baseUrl: "https://api.revenuecat.com", authHeader: "authorization", authScheme: "Bearer ", keyExample: "sk_…", labelExample: "RevenueCat" },
  // Payment
  { id: "stripe", label: "Stripe", category: "Payment", provider: "stripe", baseUrl: "https://api.stripe.com", authHeader: "authorization", authScheme: "Bearer ", keyExample: "sk_live_…", labelExample: "Stripe Live" },
  { id: "wise", label: "Wise", category: "Payment", provider: "wise", baseUrl: "https://api.wise.com", authHeader: "authorization", authScheme: "Bearer ", keyExample: "Personal API Token (UUID)", labelExample: "Wise Payouts" },
  // Email
  { id: "brevo", label: "Brevo", category: "Email", provider: "brevo", baseUrl: "https://api.brevo.com/v3", authHeader: "api-key", authScheme: "", keyExample: "xkeysib-…", labelExample: "Brevo Transaktional" },
  { id: "resend-email", label: "Resend", category: "Email", provider: "resend", baseUrl: "https://api.resend.com", authHeader: "authorization", authScheme: "Bearer ", keyExample: "re_…", labelExample: "Resend" },
  { id: "sendgrid", label: "SendGrid", category: "Email", provider: "sendgrid", baseUrl: "https://api.sendgrid.com", authHeader: "authorization", authScheme: "Bearer ", keyExample: "SG.…", labelExample: "SendGrid" },
  { id: "postmark", label: "Postmark", category: "Email", provider: "postmark", baseUrl: "https://api.postmarkapp.com", authHeader: "x-postmark-server-token", authScheme: "", keyExample: "Server-Token …", labelExample: "Postmark" },
  // Resend (eigene Kategorie)
  { id: "resend", label: "Resend", category: "Resend", provider: "resend", baseUrl: "https://api.resend.com", authHeader: "authorization", authScheme: "Bearer ", keyExample: "re_…", labelExample: "Resend Transaktional" },
  // Automation
  { id: "n8n", label: "n8n Cloud", category: "Automation", provider: "n8n", baseUrl: "", authHeader: "x-n8n-api-key", authScheme: "", keyExample: "eyJ… (JWT)", labelExample: "n8n Cloud API" },
  { id: "apify", label: "Apify", category: "Automation", provider: "apify", baseUrl: "https://api.apify.com/v2", authHeader: "authorization", authScheme: "Bearer ", keyExample: "apify_api_…", labelExample: "Apify" },
  // Social / Marketing
  { id: "blotato", label: "Blotato", category: "Social / Marketing", provider: "blotato", baseUrl: "https://backend.blotato.com/v2", authHeader: "blotato-api-key", authScheme: "", keyExample: "…== (Base64, = gehört dazu)", labelExample: "Blotato" },
  // Mobile / Stores
  { id: "appstore", label: "App Store Connect (.p8)", category: "Mobile / Stores", provider: "apple", baseUrl: "", authHeader: "authorization", authScheme: "Bearer ", keyExample: "-----BEGIN PRIVATE KEY----- (.p8)", labelExample: "App Store Connect API" },
  { id: "expo", label: "Expo / EAS", category: "Mobile / Stores", provider: "expo", baseUrl: "https://api.expo.dev", authHeader: "authorization", authScheme: "Bearer ", keyExample: "Expo Access-Token", labelExample: "Expo EAS" },
  // Infrastruktur
  { id: "vercel", label: "Vercel", category: "Infrastruktur", provider: "vercel", baseUrl: "https://api.vercel.com", authHeader: "authorization", authScheme: "Bearer ", keyExample: "Bearer-Token …", labelExample: "Vercel Token" },
  { id: "github", label: "GitHub", category: "Infrastruktur", provider: "github", baseUrl: "https://api.github.com", authHeader: "authorization", authScheme: "Bearer ", keyExample: "ghp_… / github_pat_…", labelExample: "GitHub PAT" },
];

const SELECT_CLASS =
  "w-full px-3.5 py-3 text-sm [font-family:var(--font-body)] text-fg bg-bg border border-line-strong rounded-[var(--radius-sm)] transition-[border-color,box-shadow,background] focus:border-fg focus:bg-surface focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--fg)_12%,transparent)] cursor-pointer";

// The metadata + key fields for the add form; rotate reuses only the key field.
// Picking a category narrows the provider-preset dropdown; picking a preset
// auto-fills provider + base URL + the matching auth header/scheme, and the
// placeholders switch to a fitting example.
function KeyFields({ includeMeta }: { includeMeta: boolean }) {
  const [category, setCategory] = useState("");
  const [provider, setProvider] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authHeader, setAuthHeader] = useState("authorization");
  const [authScheme, setAuthScheme] = useState("Bearer ");
  const [presetId, setPresetId] = useState("");

  const catEx = exampleFor(category);
  const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
  const keyHint = preset?.keyExample ?? catEx.key;
  const labelHint = preset?.labelExample ?? catEx.label;

  // Presets for the typed category (exact, case-insensitive). With a match the
  // dropdown lists just those; otherwise it lists all, grouped by category.
  const catKey = category.trim().toLowerCase();
  const matching = PROVIDER_PRESETS.filter((p) => p.category.toLowerCase() === catKey);
  const showGrouped = matching.length === 0;

  function pickCategory(value: string) {
    setCategory(value);
    setPresetId(""); // a new category invalidates the chosen preset
  }
  function pickPreset(id: string) {
    setPresetId(id);
    const p = PROVIDER_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setProvider(p.provider);
    setBaseUrl(p.baseUrl);
    setAuthHeader(p.authHeader);
    setAuthScheme(p.authScheme);
    if (!category.trim()) setCategory(p.category);
  }

  return (
    <div className="grid grid-cols-2 gap-3.5">
      {includeMeta && (
        <>
          <Field name="label" label="Label" required placeholder={`z.B. ${labelHint}`} />
          <Field
            name="category"
            label="Kategorie"
            list="vault-categories"
            autoComplete="off"
            placeholder="z.B. KI / LLM"
            value={category}
            onChange={(e) => pickCategory(e.target.value)}
          />
          <datalist id="vault-categories">
            {CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          {/* Provider preset — fills provider + URL + auth header/scheme. */}
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="provider-preset">
              Provider-Vorlage <span className="text-fg-4 font-normal">(füllt URL + Auth automatisch)</span>
            </Label>
            <select
              id="provider-preset"
              className={SELECT_CLASS}
              value={presetId}
              onChange={(e) => pickPreset(e.target.value)}
            >
              <option value="">
                {category.trim() ? `— ${category.trim()}-Provider wählen —` : "— Provider wählen (optional) —"}
              </option>
              {showGrouped
                ? CATEGORY_SUGGESTIONS.map((c) => {
                    const items = PROVIDER_PRESETS.filter((p) => p.category === c);
                    if (items.length === 0) return null;
                    return (
                      <optgroup key={c} label={c}>
                        {items.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })
                : matching.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
            </select>
          </div>

          <Field
            name="provider"
            label="Provider"
            placeholder={`z.B. ${preset?.provider ?? catEx.provider}`}
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          />
          <Field
            name="auth_header"
            label="Auth-Header"
            value={authHeader}
            onChange={(e) => setAuthHeader(e.target.value)}
          />
          <Field
            name="base_url"
            label="Base-URL — leer lassen = nur speichern (kein Proxy)"
            type="url"
            placeholder={preset?.baseUrl || catEx.baseUrl}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="col-span-2"
          />
          <Field
            name="auth_scheme"
            label="Schema-Prefix (leer bei x-api-key / api-key)"
            placeholder="Bearer "
            value={authScheme}
            onChange={(e) => setAuthScheme(e.target.value)}
            className="col-span-2"
          />
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
          placeholder={includeMeta ? keyHint : "neuer Key …"}
          style={{ fontFamily: "var(--font-mono)" }}
        />
        {includeMeta && (
          <p className="text-[11px] text-fg-4">
            Beispiel für {preset?.label || category.trim() || "diese Kategorie"}:{" "}
            <code className="[font-family:var(--font-mono)]">{keyHint}</code>
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
  const [query, setQuery] = useState("");

  // Client-side filter over the already-loaded rows (label / provider /
  // category / base URL). Empty query shows everything.
  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) => [r.label, r.provider, r.category, r.baseUrl].some((v) => v.toLowerCase().includes(q)))
    : rows;

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
      {/* Toolbar: search + add key */}
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-fg-4 pointer-events-none" />
          <Input
            type="search"
            placeholder="Suchen: Label, Provider, Kategorie, URL …"
            aria-label="Vault durchsuchen"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
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
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 text-center px-6 py-10 border border-dashed border-line-strong rounded-[var(--radius)] bg-surface text-fg-3">
          <Search className="size-7 text-fg-4 mb-0.5" strokeWidth={1.5} />
          <div className="[font-family:var(--font-body)] font-semibold text-sm text-fg-2">Keine Treffer für „{query.trim()}“</div>
          <button type="button" onClick={() => setQuery("")} className="text-[13px] text-fg-3 underline underline-offset-2 hover:text-fg">
            Suche zurücksetzen
          </button>
        </div>
      ) : (
        groupByCategory(filtered).map(({ category, rows: catRows }) => (
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
