"use client";

// Vault management UI, built on the shadcn/ui kit (src/components/ui/*) which is
// themed to the admin tokens. Plaintext keys are never shown except the explicit
// "reveal" dialog (admin-only, fetched on demand and cleared on close).
//
// UI copy follows the admin language (DE/EN switch in the sidebar) via tAdmin().
// Vault DATA is not translated: labels, providers and category names are what
// the admin typed and stay byte-identical in both languages — the category
// datalist would otherwise write English names into rows that already group
// under German ones.

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
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { loc, tAdmin, type AdminLang, type Localized } from "../_i18n";

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
// can also type a category that isn't in this list. Deliberately NOT translated
// — these are the values that get stored on the row.
const CATEGORY_SUGGESTIONS = [
  "KI / LLM",
  "Datenbank",
  "RevenueCat",
  "Payment",
  "Email",
  "Resend",
  "Automation",
  "Social / Marketing",
  "Scraping",
  "Mobile / Stores",
  "TMDB",
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
// Fields typed `Localized` read as prose and therefore switch with the UI
// language; plain strings (URLs, key shapes) are the same in both.
interface CategoryExample {
  label: Localized;
  provider: string;
  baseUrl: Localized;
  baseUrlFill: string;
  key: Localized;
}
const DEFAULT_EXAMPLE: CategoryExample = {
  label: { de: "Mein Service", en: "My service" },
  provider: "custom",
  baseUrl: {
    de: "https://api.example.com  ·  leer = nur speichern",
    en: "https://api.example.com  ·  empty = store only",
  },
  baseUrlFill: "",
  key: { de: "Key / Token …", en: "Key / token …" },
};
const CATEGORY_EXAMPLES: Record<string, CategoryExample> = {
  "KI / LLM": { label: "OpenAI Prod", provider: "openai", baseUrl: "https://api.openai.com", baseUrlFill: "https://api.openai.com", key: "sk-proj-…  /  sk-ant-…" },
  Datenbank: {
    label: "Supabase Service Role – Klar",
    provider: "supabase",
    baseUrl: { de: "leer lassen = nur speichern (Service Role)", en: "leave empty = store only (service role)" },
    baseUrlFill: "",
    key: "eyJhbGci… (JWT)  /  sb_secret_…",
  },
  RevenueCat: { label: "RevenueCat – MyLoo (iOS)", provider: "revenuecat", baseUrl: "https://api.revenuecat.com", baseUrlFill: "https://api.revenuecat.com", key: "sk_… (secret)  /  appl_… (public)" },
  Payment: { label: "Stripe Live", provider: "stripe", baseUrl: "https://api.stripe.com", baseUrlFill: "https://api.stripe.com", key: "sk_live_…" },
  Email: { label: { de: "Brevo Transaktional", en: "Brevo transactional" }, provider: "brevo", baseUrl: "https://api.brevo.com/v3", baseUrlFill: "https://api.brevo.com/v3", key: "xkeysib-…" },
  Resend: { label: { de: "Resend – Transaktional", en: "Resend – transactional" }, provider: "resend", baseUrl: "https://api.resend.com", baseUrlFill: "https://api.resend.com", key: "re_…" },
  Automation: {
    label: "n8n Cloud API",
    provider: "n8n",
    baseUrl: { de: "https://<konto>.app.n8n.cloud/api/v1", en: "https://<account>.app.n8n.cloud/api/v1" },
    baseUrlFill: "",
    key: "eyJ… (JWT)",
  },
  "Social / Marketing": { label: "Blotato", provider: "blotato", baseUrl: "https://backend.blotato.com", baseUrlFill: "https://backend.blotato.com", key: { de: "Blotato API-Key", en: "Blotato API key" } },
  "Mobile / Stores": {
    label: "App Store Connect API",
    provider: "apple",
    baseUrl: "https://api.appstoreconnect.apple.com",
    baseUrlFill: "https://api.appstoreconnect.apple.com",
    key: "-----BEGIN PRIVATE KEY----- (.p8)",
  },
  TMDB: { label: "TMDB Read Access Token (v4)", provider: "tmdb", baseUrl: "https://api.themoviedb.org", baseUrlFill: "https://api.themoviedb.org", key: { de: "eyJ… (v4 Bearer) / 32-Hex (v3)", en: "eyJ… (v4 bearer) / 32-hex (v3)" } },
  Infrastruktur: { label: "Vercel Token", provider: "vercel", baseUrl: "https://api.vercel.com", baseUrlFill: "https://api.vercel.com", key: { de: "Bearer-Token …", en: "Bearer token …" } },
  Sonstiges: DEFAULT_EXAMPLE,
};

function exampleFor(category: string): CategoryExample {
  return CATEGORY_EXAMPLES[category.trim()] ?? DEFAULT_EXAMPLE;
}

// Group rows by category, ordered by the suggestion list, then custom
// categories alphabetically, with "Sonstiges" always last.
function groupByCategory(rows: VaultRow[], lang: AdminLang): Array<{ category: string; rows: VaultRow[] }> {
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
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], lang))
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
  authIn?: "header" | "query"; // "query" => authHeader is the query-param name (e.g. Evomi ?api_key=)
  // "asc" swaps the single key field for App Store Connect's three-part key
  // material (issuer id + key id + .p8). Auth routing is fixed server-side for
  // those, so the header/scheme fields are hidden.
  keyKind?: "asc";
  keyExample: Localized;
  labelExample: Localized;
}
const PROVIDER_PRESETS: ProviderPreset[] = [
  // KI / LLM
  { id: "anthropic", label: "Anthropic (Claude)", category: "KI / LLM", provider: "anthropic", baseUrl: "https://api.anthropic.com", authHeader: "x-api-key", authScheme: "", keyExample: "sk-ant-…", labelExample: "Anthropic Prod" },
  { id: "openai", label: "OpenAI", category: "KI / LLM", provider: "openai", baseUrl: "https://api.openai.com", authHeader: "authorization", authScheme: "Bearer ", keyExample: "sk-proj-… / sk-…", labelExample: "OpenAI Prod" },
  { id: "gemini", label: "Google Gemini", category: "KI / LLM", provider: "google", baseUrl: "https://generativelanguage.googleapis.com", authHeader: "x-goog-api-key", authScheme: "", keyExample: "AIza…", labelExample: "Gemini" },
  { id: "mistral", label: "Mistral", category: "KI / LLM", provider: "mistral", baseUrl: "https://api.mistral.ai", authHeader: "authorization", authScheme: "Bearer ", keyExample: { de: "API-Key …", en: "API key …" }, labelExample: "Mistral" },
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
  { id: "brevo", label: "Brevo", category: "Email", provider: "brevo", baseUrl: "https://api.brevo.com/v3", authHeader: "api-key", authScheme: "", keyExample: "xkeysib-…", labelExample: { de: "Brevo Transaktional", en: "Brevo transactional" } },
  { id: "resend-email", label: "Resend", category: "Email", provider: "resend", baseUrl: "https://api.resend.com", authHeader: "authorization", authScheme: "Bearer ", keyExample: "re_…", labelExample: "Resend" },
  { id: "sendgrid", label: "SendGrid", category: "Email", provider: "sendgrid", baseUrl: "https://api.sendgrid.com", authHeader: "authorization", authScheme: "Bearer ", keyExample: "SG.…", labelExample: "SendGrid" },
  { id: "postmark", label: "Postmark", category: "Email", provider: "postmark", baseUrl: "https://api.postmarkapp.com", authHeader: "x-postmark-server-token", authScheme: "", keyExample: { de: "Server-Token …", en: "Server token …" }, labelExample: "Postmark" },
  // Resend (eigene Kategorie)
  { id: "resend", label: "Resend", category: "Resend", provider: "resend", baseUrl: "https://api.resend.com", authHeader: "authorization", authScheme: "Bearer ", keyExample: "re_…", labelExample: { de: "Resend Transaktional", en: "Resend transactional" } },
  // Automation
  { id: "n8n", label: "n8n Cloud", category: "Automation", provider: "n8n", baseUrl: "", authHeader: "x-n8n-api-key", authScheme: "", keyExample: "eyJ… (JWT)", labelExample: "n8n Cloud API" },
  { id: "apify", label: "Apify", category: "Automation", provider: "apify", baseUrl: "https://api.apify.com/v2", authHeader: "authorization", authScheme: "Bearer ", keyExample: "apify_api_…", labelExample: "Apify" },
  // Social / Marketing
  { id: "blotato", label: "Blotato", category: "Social / Marketing", provider: "blotato", baseUrl: "https://backend.blotato.com/v2", authHeader: "blotato-api-key", authScheme: "", keyExample: { de: "…== (Base64, = gehört dazu)", en: "…== (Base64, the = is part of it)" }, labelExample: "Blotato" },
  // SlideYourApp keys are shown once and stored hashed on their side — losing
  // one means replacing it, not looking it up. base_url carries the /api/v1
  // segment because their MCP server sits outside it (app.slideyourapp.com/mcp)
  // and is not reachable through this entry.
  { id: "slideyourapp", label: "SlideYourApp", category: "Social / Marketing", provider: "slideyourapp", baseUrl: "https://app.slideyourapp.com/api/v1", authHeader: "authorization", authScheme: "Bearer ", keyExample: "nl_…", labelExample: "SlideYourApp" },
  // Scraping
  { id: "evomi", label: "Evomi (Scraper API)", category: "Scraping", provider: "evomi", baseUrl: "https://scrape.evomi.com/api/v1/scraper", authHeader: "api_key", authScheme: "", authIn: "query", keyExample: { de: "Evomi api_key (Query-Param)", en: "Evomi api_key (query param)" }, labelExample: "Evomi Scraper API" },
  // Personal API Key (my.evomi.com → Settings → API) — account-level: balance,
  // credits, proxy data. NOT the scraper key. Feeds the Evomi-Credits billing card.
  { id: "evomi-public", label: "Evomi (Public API / Credits)", category: "Scraping", provider: "evomi", baseUrl: "https://api.evomi.com/public", authHeader: "x-apikey", authScheme: "", keyExample: "Personal API Key (Settings → API)", labelExample: "Evomi Public API" },
  // Mobile / Stores
  // Proxyable despite the .p8: the vault stores the key material and signs a
  // fresh ES256 JWT per request (src/lib/ascJwt.ts), because Apple accepts
  // nothing else. base_url deliberately without a version segment so both
  // `v1/apps` and the reporting endpoints are reachable through one entry.
  { id: "appstore", label: "App Store Connect (.p8)", category: "Mobile / Stores", provider: "apple", baseUrl: "https://api.appstoreconnect.apple.com", authHeader: "authorization", authScheme: "Bearer ", keyKind: "asc", keyExample: "-----BEGIN PRIVATE KEY----- (.p8)", labelExample: "App Store Connect API" },
  { id: "expo", label: "Expo / EAS", category: "Mobile / Stores", provider: "expo", baseUrl: "https://api.expo.dev", authHeader: "authorization", authScheme: "Bearer ", keyExample: { de: "Expo Access-Token", en: "Expo access token" }, labelExample: "Expo EAS" },
  // TMDB (eigene Kategorie) — v4-Token läuft als Bearer über den Proxy, der
  // v3-Key via Query-Param-Injection (?api_key=…, wie Evomi).
  { id: "tmdb-v4", label: "TMDB Read Access Token (v4, Proxy)", category: "TMDB", provider: "tmdb", baseUrl: "https://api.themoviedb.org", authHeader: "authorization", authScheme: "Bearer ", keyExample: "eyJhbGci… (v4 JWT)", labelExample: "TMDB Read Access Token (v4)" },
  { id: "tmdb-v3", label: "TMDB API Key (v3, Query-Param)", category: "TMDB", provider: "tmdb", baseUrl: "https://api.themoviedb.org", authHeader: "api_key", authScheme: "", authIn: "query", keyExample: { de: "32-stelliger Hex-Key (v3)", en: "32-character hex key (v3)" }, labelExample: "TMDB API Key (v3)" },
  // Sonstiges
  // Unsplash authenticates public requests with a "Client-ID " scheme on the
  // standard authorization header — not Bearer. The stored key is the ACCESS
  // key (the secret key is only for the OAuth user flow and must not go here).
  // Demo apps get 50 req/h, 1000 after approval; image file downloads from
  // images.unsplash.com do not count against that.
  { id: "unsplash", label: "Unsplash (Access Key)", category: "Sonstiges", provider: "unsplash", baseUrl: "https://api.unsplash.com", authHeader: "authorization", authScheme: "Client-ID ", keyExample: { de: "Access Key (43 Zeichen)", en: "Access key (43 characters)" }, labelExample: "Unsplash Access Key" },
  // Pexels sends the raw key on `authorization` with NO scheme prefix at all —
  // not Bearer, not Client-ID. base_url deliberately without a version segment
  // so both APIs are reachable through one entry: photos live under `v1/…`
  // (e.g. `v1/search?query=roadtrip`), videos under `videos/…`.
  // Limits: 200 req/h and 20'000/month; image/video file downloads don't count.
  { id: "pexels", label: "Pexels (API Key)", category: "Sonstiges", provider: "pexels", baseUrl: "https://api.pexels.com", authHeader: "authorization", authScheme: "", keyExample: { de: "56-stelliger alphanumerischer Key", en: "56-character alphanumeric key" }, labelExample: "Pexels API Key" },
  // Infrastruktur
  { id: "vercel", label: "Vercel", category: "Infrastruktur", provider: "vercel", baseUrl: "https://api.vercel.com", authHeader: "authorization", authScheme: "Bearer ", keyExample: { de: "Bearer-Token …", en: "Bearer token …" }, labelExample: "Vercel Token" },
  { id: "github", label: "GitHub", category: "Infrastruktur", provider: "github", baseUrl: "https://api.github.com", authHeader: "authorization", authScheme: "Bearer ", keyExample: "ghp_… / github_pat_…", labelExample: "GitHub PAT" },
];

const SELECT_CLASS =
  "w-full px-3.5 py-3 text-sm [font-family:var(--font-body)] text-fg bg-bg border border-line-strong rounded-[var(--radius-sm)] transition-[border-color,box-shadow,background] focus:border-fg focus:bg-surface focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--fg)_12%,transparent)] cursor-pointer";

// Same look as SELECT_CLASS, minus the pointer: a .p8 is a multi-line PEM and
// does not fit the single-line key input.
const TEXTAREA_CLASS =
  "w-full px-3.5 py-3 text-sm [font-family:var(--font-mono)] text-fg bg-bg border border-line-strong rounded-[var(--radius-sm)] transition-[border-color,box-shadow,background] focus:border-fg focus:bg-surface focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--fg)_12%,transparent)] resize-y";

const P8_PLACEHOLDER = "-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49…\n-----END PRIVATE KEY-----";

// The metadata + key fields for the add form; rotate reuses only the key field.
// Picking a category narrows the provider-preset dropdown; picking a preset
// auto-fills provider + base URL + the matching auth header/scheme, and the
// placeholders switch to a fitting example.
function KeyFields({
  includeMeta,
  lang,
  asc: ascRow = false,
}: {
  includeMeta: boolean;
  lang: AdminLang;
  /** Rotate mode only: the row being rotated holds ASC key material, so the
   *  form must ask for the same three parts again instead of one key. */
  asc?: boolean;
}) {
  const t = tAdmin(lang);
  const [category, setCategory] = useState("");
  const [provider, setProvider] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authHeader, setAuthHeader] = useState("authorization");
  const [authScheme, setAuthScheme] = useState("Bearer ");
  const [authIn, setAuthIn] = useState<"header" | "query">("header");
  const [presetId, setPresetId] = useState("");

  const catEx = exampleFor(category);
  const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
  // Add form: the picked preset decides. Rotate form: the row does.
  const isAsc = includeMeta ? preset?.keyKind === "asc" : ascRow;
  const keyHint = loc(preset?.keyExample ?? catEx.key, lang);
  const labelHint = loc(preset?.labelExample ?? catEx.label, lang);

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
    setAuthIn(p.authIn === "query" ? "query" : "header");
    if (!category.trim()) setCategory(p.category);
  }

  return (
    <div className="grid grid-cols-2 gap-3.5">
      {includeMeta && (
        <>
          <Field name="label" label={t.fieldLabel} required placeholder={t.eg(labelHint)} />
          <Field
            name="category"
            label={t.fieldCategory}
            list="vault-categories"
            autoComplete="off"
            placeholder={t.fieldCategoryPlaceholder}
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
              {t.fieldPreset} <span className="text-fg-4 font-normal">{t.fieldPresetHint}</span>
            </Label>
            <select
              id="provider-preset"
              className={SELECT_CLASS}
              value={presetId}
              onChange={(e) => pickPreset(e.target.value)}
            >
              <option value="">{category.trim() ? t.presetPickIn(category.trim()) : t.presetPickAny}</option>
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
            label={t.fieldProvider}
            placeholder={t.eg(preset?.provider ?? catEx.provider)}
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          />
          {!isAsc && (
            <Field
              name="auth_header"
              label={authIn === "query" ? t.fieldQueryParam : t.fieldAuthHeader}
              value={authHeader}
              onChange={(e) => setAuthHeader(e.target.value)}
            />
          )}
          <Field
            name="base_url"
            label={t.fieldBaseUrl}
            type="url"
            placeholder={preset?.baseUrl || loc(catEx.baseUrl, lang)}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="col-span-2"
          />
          {/* App Store Connect has no choice of auth routing: the proxy always
              sends the freshly signed JWT as `Authorization: Bearer …`, so
              showing these would only invite a config that silently 401s. */}
          {!isAsc && (
            <>
              <Field
                name="auth_scheme"
                label={t.fieldAuthScheme}
                placeholder="Bearer "
                value={authScheme}
                onChange={(e) => setAuthScheme(e.target.value)}
                className="col-span-2"
              />
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="auth_in">
                  {t.fieldAuthIn}{" "}
                  <span className="text-fg-4 font-normal">
                    {t.fieldAuthInHintA}
                    <code>?api_key=</code>
                    {t.fieldAuthInHintB}
                  </span>
                </Label>
                <select
                  id="auth_in"
                  name="auth_in"
                  className={SELECT_CLASS}
                  value={authIn}
                  onChange={(e) => setAuthIn(e.target.value === "query" ? "query" : "header")}
                >
                  <option value="header">{t.optHeader}</option>
                  <option value="query">{t.optQuery}</option>
                </select>
              </div>
            </>
          )}
        </>
      )}
      {isAsc ? (
        <>
          {/* Three parts instead of one key — packed into a single encrypted
              blob by /admin/vault/save, which test-signs it before storing. */}
          <input type="hidden" name="key_kind" value="asc" />
          <Field
            name="asc_issuer_id"
            label={t.fieldAscIssuer}
            required
            autoComplete="off"
            placeholder="00000000-1111-2222-3333-444444444444"
            style={{ fontFamily: "var(--font-mono)" }}
            className="col-span-2"
          />
          <Field
            name="asc_key_id"
            label={t.fieldAscKeyId}
            required
            autoComplete="off"
            placeholder="ABCD1EF2GH"
            style={{ fontFamily: "var(--font-mono)" }}
            className="col-span-2"
          />
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="asc_p8">{t.fieldAscP8}</Label>
            <textarea
              id="asc_p8"
              name="asc_p8"
              required
              rows={5}
              spellCheck={false}
              autoComplete="off"
              className={TEXTAREA_CLASS}
              placeholder={P8_PLACEHOLDER}
            />
            <p className="text-[11px] text-fg-4">{t.ascHint}</p>
          </div>
        </>
      ) : (
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="secret">{t.fieldSecret}</Label>
          <Input
            id="secret"
            name="secret"
            type="password"
            required
            autoComplete="new-password"
            placeholder={includeMeta ? keyHint : t.secretPlaceholderRotate}
            style={{ fontFamily: "var(--font-mono)" }}
          />
          {includeMeta && (
            <p className="text-[11px] text-fg-4">
              {t.exampleFor(preset?.label || category.trim() || t.thisCategory)}{" "}
              <code className="[font-family:var(--font-mono)]">{keyHint}</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Pre-filled metadata fields for the edit dialog (no key field — the stored key
// is never touched here). Uncontrolled defaults; the form is remounted per row
// (key={editRow.id}) so the defaults always reflect the row being edited.
function MetaFields({ row, lang }: { row: VaultRow; lang: AdminLang }) {
  const t = tAdmin(lang);
  return (
    <div className="grid grid-cols-2 gap-3.5">
      <Field name="label" label={t.fieldLabel} required defaultValue={row.label} />
      <Field
        name="category"
        label={t.fieldCategory}
        list="vault-categories-edit"
        autoComplete="off"
        placeholder={t.eg("Datenbank")}
        defaultValue={row.category === "Sonstiges" ? "" : row.category}
      />
      <datalist id="vault-categories-edit">
        {CATEGORY_SUGGESTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <Field name="provider" label={t.fieldProvider} defaultValue={row.provider} />
      <Field name="auth_header" label={t.fieldAuthHeader} defaultValue={row.authHeader || "authorization"} />
      <Field
        name="base_url"
        label={t.fieldBaseUrl}
        type="url"
        placeholder="https://api.example.com"
        defaultValue={row.baseUrl}
        className="col-span-2"
      />
      <Field name="auth_scheme" label={t.fieldAuthSchemeShort} defaultValue={row.authScheme || "Bearer "} className="col-span-2" />
    </div>
  );
}

export default function VaultManager({ rows, lang }: { rows: VaultRow[]; lang: AdminLang }) {
  const t = tAdmin(lang);
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
          setReveal({ loading: false, key: null, error: data.error || t.revealError(res.status) });
        } else {
          setReveal({ loading: false, key: data.key, error: null });
        }
      })
      .catch(() => setReveal({ loading: false, key: null, error: t.revealNetworkError }));
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
            <span className="text-[11px] text-fg-4">{t.storeOnly}</span>
          )}
        </TableCell>
        <TableCell className="text-right text-fg-3">{r.lastUsed}</TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => openReveal(r)}>
              <Eye /> {t.showKey}
            </Button>
            {/* modal={false}: a modal dropdown locks body pointer-events while
                open and, when an item opens a Dialog/AlertDialog, leaves
                `pointer-events: none` stuck on <body> — freezing every control
                inside that dialog (the rotate/delete buttons would not respond).
                Non-modal here avoids that; the dialogs are modal themselves. */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label={t.moreActions}>
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
                    <Copy /> {copiedId === r.id ? t.copied : t.copyProxy}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setEditRow(r)}>
                  <Pencil /> {t.edit}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setRotateRow(r)}>
                  <RefreshCw /> {t.rotate}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem danger onSelect={() => setDeleteRow(r)}>
                  <Trash2 /> {t.delete}
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
            placeholder={t.searchPlaceholder}
            aria-label={t.searchAria}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="pop">
              <Plus /> {t.addKey}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.addTitle}</DialogTitle>
              <DialogDescription>{t.addBody}</DialogDescription>
            </DialogHeader>
            <form method="POST" action="/admin/vault/save" autoComplete="off">
              <input type="hidden" name="action" value="add" />
              <KeyFields includeMeta lang={lang} />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    {t.cancel}
                  </Button>
                </DialogClose>
                <Button type="submit">{t.addSubmit}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 text-center px-6 py-10 border border-dashed border-line-strong rounded-[var(--radius)] bg-surface text-fg-3">
          <KeyRound className="size-7 text-fg-4 mb-0.5" strokeWidth={1.5} />
          <div className="[font-family:var(--font-body)] font-semibold text-sm text-fg-2">{t.emptyTitle}</div>
          <div className="text-[13px] text-fg-3 max-w-[42ch] leading-relaxed">{t.emptyBody}</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 text-center px-6 py-10 border border-dashed border-line-strong rounded-[var(--radius)] bg-surface text-fg-3">
          <Search className="size-7 text-fg-4 mb-0.5" strokeWidth={1.5} />
          <div className="[font-family:var(--font-body)] font-semibold text-sm text-fg-2">{t.noHits(query.trim())}</div>
          <button type="button" onClick={() => setQuery("")} className="text-[13px] text-fg-3 underline underline-offset-2 hover:text-fg">
            {t.resetSearch}
          </button>
        </div>
      ) : (
        groupByCategory(filtered, lang).map(({ category, rows: catRows }) => (
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
                  <TableHead>{t.colKey}</TableHead>
                  <TableHead>{t.colProxy}</TableHead>
                  <TableHead className="text-right">{t.colLastUsed}</TableHead>
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
            <DialogTitle>{t.rotateTitle}</DialogTitle>
            <DialogDescription>{t.rotateBody(rotateRow?.label ?? "")}</DialogDescription>
          </DialogHeader>
          <form method="POST" action="/admin/vault/save" autoComplete="off">
            <input type="hidden" name="action" value="rotate" />
            <input type="hidden" name="id" value={rotateRow?.id ?? ""} />
            {/* An ASC row rotates by re-entering the three key parts. The
                upstream URL is the only ASC marker the client can see — the
                key material itself never leaves the server. */}
            <KeyFields
              includeMeta={false}
              lang={lang}
              asc={(rotateRow?.baseUrl ?? "").includes("appstoreconnect.apple.com")}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  {t.cancel}
                </Button>
              </DialogClose>
              <Button type="submit">{t.rotateSubmit}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit metadata (label / category / provider / routing) — key untouched */}
      <Dialog open={editRow !== null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.editTitle}</DialogTitle>
            <DialogDescription>{t.editBody(editRow?.label ?? "")}</DialogDescription>
          </DialogHeader>
          {editRow && (
            <form key={editRow.id} method="POST" action="/admin/vault/save" autoComplete="off">
              <input type="hidden" name="action" value="edit" />
              <input type="hidden" name="id" value={editRow.id} />
              <MetaFields row={editRow} lang={lang} />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    {t.cancel}
                  </Button>
                </DialogClose>
                <Button type="submit">{t.editSubmit}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Reveal (read the plaintext back — admin only) */}
      <Dialog open={revealRow !== null} onOpenChange={(o) => !o && closeReveal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.revealTitle(revealRow?.label ?? "")}</DialogTitle>
            <DialogDescription>{t.revealBody}</DialogDescription>
          </DialogHeader>
          {reveal.loading ? (
            <p className="text-fg-3 text-sm">{t.revealLoading}</p>
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
                    {t.close}
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
                  {revealCopied ? t.copiedKey : t.copyKey}
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
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteBody(deleteRow?.label ?? "")}</AlertDialogDescription>
          </AlertDialogHeader>
          <form method="POST" action="/admin/vault/save">
            <input type="hidden" name="action" value="delete" />
            <input type="hidden" name="id" value={deleteRow?.id ?? ""} />
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="ghost">
                  {t.cancel}
                </Button>
              </AlertDialogCancel>
              {/* NOT wrapped in AlertDialogAction: that renders a
                  DialogPrimitive.Close, so the click closes the dialog, React
                  unmounts this <form>, and the POST never leaves the browser.
                  The delete silently did nothing while the UI looked fine.
                  The rotate dialog above submits with a plain button for the
                  same reason; only Cancel belongs in AlertDialogCancel. */}
              <Button type="submit" variant="danger">
                {t.deleteSubmit}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
