// Klar Control · Inbox — affiliate + consulting contact-form requests.
//
// Server component. Reads klar_inquiries from the anime-vault project (service
// role key), joins outreach targets for the reply composer, and renders filter
// tabs + per-request cards with approve / decline / reply actions. Same chrome
// + 2FA gate as the rest of /admin, plus the confirm-modal infra (decline +
// reply forms carry data-klar-confirm) and the shared reply-composer JS. Inner
// content is an HTML string (byte-identical to the old route.ts inboxView),
// injected into .content; the reply-composer <script> can't run from innerHTML,
// so it's rendered as a top-level <script> element when a card needs it.
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET, KLAR_INBOX_SERVICE_KEY
//      (+ optional KLAR_INBOX_SUPABASE_URL).

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  STYLE,
  ICON,
  FONTS_LINK,
  THEME_INIT_SCRIPT,
  THEME_TOGGLE_SCRIPT,
  GLASS_SVG_DEFS,
  SMOKE_BG_SCRIPT,
  MODAL_HTML,
  MODAL_SCRIPT,
  readCookieFromString,
  adminSidebar,
  mailTabs,
  esc,
  fmtRelative,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps, setupLandingUrl } from "../../../lib/adminApps";
import { listOutreachTargets, type OutreachTarget } from "../../../lib/outreachStore";
import { KLAR_APPS } from "../../../lib/klarApps";
import { REPLY_TEMPLATES, replyLang } from "../../../lib/replyTemplates";
import { replyTemplateSelectOptions, REPLY_INBOX_JS } from "../_reply";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Contact-form inbox source (anime-vault). Service key lives only in Vercel env.
const KLAR_INBOX_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KLAR_INBOX_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

interface Inquiry {
  id?: string;
  created_at?: string;
  type?: string;
  email?: string;
  status?: string;
  handle?: string;
  audience?: string;
  platforms?: string;
  why?: string;
  name?: string;
  project?: string;
  budget?: string;
  brief?: string;
  source?: string;
  approved_app?: string;
  approved_code?: string;
  approved_at?: string;
  target_app?: string;
  declined_at?: string | null;
  decline_reason?: string | null;
}

// Known source values + readable labels. Falls back to the raw value.
const SOURCE_META: Record<string, { label: string; bg: string; fg: string }> = {
  "getklar.org":    { label: "Kontaktformular", bg: "#e0e7ff", fg: "#3730a3" },
  "outreach-reply": { label: "Outreach-Reply",  bg: "#fef3c7", fg: "#92400e" },
  "dm":             { label: "DM",              bg: "#fce7f3", fg: "#9d174d" },
  "manual":         { label: "Manuell",         bg: "#dcfce7", fg: "#166534" },
};
const SOURCE_KEYS = ["getklar.org", "outreach-reply", "dm", "manual"] as const;

// Quiet-Pill (mirrors route.ts): one neutral surface tone, colour only as
// restrained text tinting via tokens. Kept local to this route.
type PillTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";
const TONE_FG: Record<PillTone, string> = {
  neutral: "var(--fg-3)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  accent: "var(--fg)",
};
function quietPill(label: string, tone: PillTone = "neutral", extra = ""): string {
  return `<span class="pill" style="background:var(--surface-2);border:1px solid var(--line);color:${TONE_FG[tone]};font-weight:600;${extra}">${esc(label)}</span>`;
}
function sourcePill(s: string | undefined): string {
  if (!s) return quietPill("unbekannt", "neutral", "font-size:10px");
  const m = SOURCE_META[s];
  return quietPill(m ? m.label : s, "neutral", "font-size:10px");
}

// Heuristik: Eintrag stammt vermutlich aus internem Self-Test. Eng gehalten
// (Owner-Email + bekannte Test-Handles), damit kein echter Influencer mit
// "test" im Namen versehentlich versteckt wird.
const isTestInquiry = (r: Inquiry): boolean => {
  const email = (r.email ?? "").toLowerCase();
  const handle = (r.handle ?? "").toLowerCase();
  if (email === "alainkessler04@gmail.com") return true;
  if (handle.includes("selftest") || handle === "klar_test" || handle === "@bombo") return true;
  return false;
};

async function inboxMain(
  typeFilter: string,
  sourceFilter: string,
  showDeclined: boolean,
  showTests: boolean,
): Promise<{ html: string; hasReplyComposer: boolean }> {
  if (!KLAR_INBOX_KEY)
    return { html: `<h1>Inbox</h1><p class="sub muted">Fast fertig, es fehlt nur der Lese-Key. Setze <span class="warn">KLAR_INBOX_SERVICE_KEY</span> im klar-Vercel-Projekt (Wert: anime-vault &rarr; Settings &rarr; API &rarr; <em>service_role</em>). Optional <span class="warn">KLAR_INBOX_SUPABASE_URL</span>. Anfragen werden schon dauerhaft gespeichert, nur die Anzeige hier braucht den Key.</p>`, hasReplyComposer: false };
  let rowsAll: Inquiry[] = [];
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_inquiries?select=*&order=created_at.desc&limit=200`,
      {
        headers: {
          apikey: KLAR_INBOX_KEY,
          Authorization: `Bearer ${KLAR_INBOX_KEY}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );
    if (!res.ok)
      return { html: `<h1>Inbox</h1><p class="sub muted">Anfragen konnten nicht geladen werden (HTTP ${res.status}). Vermutlich stimmt der hinterlegte service_role-Key nicht.</p>`, hasReplyComposer: false };
    const j = await res.json();
    rowsAll = Array.isArray(j) ? j : [];
  } catch {
    return { html: `<h1>Inbox</h1><p class="sub muted">Netzwerkfehler beim Laden der Inbox. Einmal neu laden hilft meist.</p>`, hasReplyComposer: false };
  }

  // Reply-Join: der echte Mail-Body einer Outreach-Reply liegt nur am
  // klar_outreach_targets-Row (last_message), nicht an der Inquiry. Wir laden
  // die Targets und matchen per contact_email (primär) bzw. handle (fallback),
  // damit Affiliate-Karten den vollen Reply-Text + Übersetzen + Antwort-Composer
  // direkt in der Inbox zeigen. Schlägt der Load fehl, bleibt die Karte schlicht.
  const targetsForReply = await listOutreachTargets({ limit: 500 });
  const targetByEmail = new Map<string, OutreachTarget>();
  const targetByHandle = new Map<string, OutreachTarget>();
  for (const t of targetsForReply) {
    const e = (t.contact_email ?? "").toLowerCase().trim();
    if (e && !targetByEmail.has(e)) targetByEmail.set(e, t);
    const h = (t.handle ?? "").toLowerCase().replace(/^@/, "").trim();
    if (h && !targetByHandle.has(h)) targetByHandle.set(h, t);
  }
  const matchTarget = (r: Inquiry): OutreachTarget | null => {
    const e = (r.email ?? "").toLowerCase().trim();
    if (e && targetByEmail.has(e)) return targetByEmail.get(e)!;
    const h = (r.handle ?? "").toLowerCase().replace(/^@/, "").trim();
    if (h && targetByHandle.has(h)) return targetByHandle.get(h)!;
    return null;
  };

  // Filter rows by selected type + source (both default "all"). Declined
  // werden by default ausgeblendet, mit Toggle-Link am Listenende; counts
  // unten zählen aber alle.
  const effectiveType = typeFilter === "consulting" || typeFilter === "affiliate" ? typeFilter : "all";
  const effectiveSource = sourceFilter && sourceFilter !== "all" ? sourceFilter : "all";
  const rows = rowsAll.filter((r) => {
    if (effectiveType !== "all" && r.type !== effectiveType) return false;
    if (effectiveSource !== "all" && (r.source ?? "") !== effectiveSource) return false;
    if (!showDeclined && r.status === "declined") return false;
    if (!showTests && isTestInquiry(r)) return false;
    return true;
  });
  const nTests = rowsAll.filter(isTestInquiry).length;

  // Build aggregate counts so filter tabs/pills show live totals.
  const totalsByType: Record<string, number> = { all: rowsAll.length, affiliate: 0, consulting: 0 };
  const totalsBySource: Record<string, number> = { all: rowsAll.length };
  for (const k of SOURCE_KEYS) totalsBySource[k] = 0;
  totalsBySource["unknown"] = 0;
  let nNew = 0;
  let nDeclined = 0;
  for (const r of rowsAll) {
    if (r.type === "affiliate") totalsByType.affiliate++;
    if (r.type === "consulting") totalsByType.consulting++;
    const s = r.source ?? "";
    if (s && totalsBySource[s] !== undefined) totalsBySource[s]++;
    else if (!s) totalsBySource["unknown"]++;
    else totalsBySource[s] = (totalsBySource[s] ?? 0) + 1;
    if (r.status === "new") nNew++;
    if (r.status === "declined") nDeclined++;
  }

  // Filter UI: type-tabs (Alle / Affiliate / Consulting) + source-pills below.
  const buildHref = (t: string, s: string) =>
    `/admin?view=inbox${t !== "all" ? `&type=${t}` : ""}${s !== "all" ? `&source=${encodeURIComponent(s)}` : ""}${showDeclined ? `&show_declined=1` : ""}${showTests ? `&show_tests=1` : ""}`;
  const tabBtn = (t: string, label: string, count: number) => `<a class="nav ${effectiveType === t ? "on" : ""}" href="${buildHref(t, effectiveSource)}" style="padding:8px 14px;border-radius:8px">${esc(label)} <span class="muted" style="margin-left:6px;font-size:11px">${count}</span></a>`;
  const typeTabs = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px 0">
    ${tabBtn("all", "Alle", totalsByType.all)}
    ${tabBtn("affiliate", "Affiliate", totalsByType.affiliate)}
    ${tabBtn("consulting", "Consulting", totalsByType.consulting)}
  </div>`;
  const sourceBtn = (s: string, label: string, count: number) => {
    const on = effectiveSource === s;
    const styleOn = `background:var(--fg);color:var(--accent-fg);border:1px solid var(--fg)`;
    return `<a href="${buildHref(effectiveType, s)}" class="pill" style="${on ? styleOn : ""};font-size:11px;padding:5px 10px;text-decoration:none">${esc(label)} <span style="opacity:0.6;margin-left:4px">${count}</span></a>`;
  };
  const sourceFilters = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 16px 0;align-items:center">
    <span class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-right:4px">Quelle</span>
    ${sourceBtn("all", "Alle", totalsBySource.all)}
    ${SOURCE_KEYS.map((s) => sourceBtn(s, SOURCE_META[s].label, totalsBySource[s] ?? 0)).join("")}
    ${totalsBySource["unknown"] ? sourceBtn("unknown", "Ohne Quelle", totalsBySource["unknown"]) : ""}
  </div>`;

  // Cards: when an explicit type is selected, split by source for that type;
  // otherwise show the high-level type breakdown.
  const cardsByType = `<div class="cards">
    <div class="card"><div class="k">Neu</div><div class="v">${nNew}</div><div class="s">ungelesen</div></div>
    <div class="card"><div class="k">Affiliate</div><div class="v">${totalsByType.affiliate}</div><div class="s">Anfragen</div></div>
    <div class="card"><div class="k">Consulting</div><div class="v">${totalsByType.consulting}</div><div class="s">Anfragen</div></div>
    <div class="card"><div class="k">Gesamt</div><div class="v">${totalsByType.all}</div><div class="s">letzte 200</div></div>
  </div>`;
  const sourceCountForType = (t: string, s: string) => rowsAll.filter((r) => r.type === t && (r.source ?? "") === s).length;
  const cardsBySource = effectiveType !== "all"
    ? `<div class="cards">
        ${SOURCE_KEYS.map((s) => `<div class="card"><div class="k">${esc(SOURCE_META[s].label)}</div><div class="v">${sourceCountForType(effectiveType, s)}</div><div class="s">${esc(effectiveType === "affiliate" ? "Affiliate" : "Consulting")}</div></div>`).join("")}
      </div>`
    : "";
  const cards = `${cardsByType}${cardsBySource}`;

  const fmt = (s: unknown) => {
    const d = new Date(String(s));
    return isNaN(d.getTime())
      ? esc(s)
      : d.toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" });
  };

  // Per-card details as label/value-pairs. Empty values are skipped — `why`
  // and `brief` get extra room because they are usually multi-sentence.
  const detailPairs = (r: Inquiry): Array<[string, string | undefined, boolean]> =>
    r.type === "affiliate"
      ? [
          ["Handle", r.handle, false],
          ["Audience", r.audience, false],
          ["Plattformen", r.platforms, false],
          ["Warum", r.why, true],
        ]
      : [
          ["Name", r.name, false],
          ["Projekt", r.project, false],
          ["Budget", r.budget, false],
          ["Brief", r.brief, true],
        ];

  // Apps that are wired up (KLAR_ADMIN_APPS env). Used to populate the
  // approve-form select. If KLAR_ADMIN_APPS is empty, the dropdown still
  // shows but submitting will return "unknown app" — that's the cue to add
  // the app's slug+serviceKey to the env first.
  const allWiredApps = getApps();
  const statusBySlug = new Map(KLAR_APPS.map((a) => [a.slug, a.status]));
  const wiredOptionsFor = (target: string | undefined): string =>
    allWiredApps
      .map((a) => {
        const status = statusBySlug.get(a.slug);
        const suffix = status ? ` · ${status}` : "";
        return `<option value="${esc(a.slug)}"${a.slug === target ? " selected" : ""}>${esc(a.name)}${suffix}</option>`;
      })
      .join("");

  // Onboarding-Link delegated to lib/adminApps.setupLandingUrl() so there is
  // exactly one place that knows the per-app host.
  const setupLinkFor = (slug: string, token: string): string => setupLandingUrl(slug, token);

  // Action-block per card: either the approved-link readout (if already
  // invited/active) or a collapsible approve-form (only for affiliate type
  // and only if still actionable). Collapsible defaults to open for "new"
  // so the admin sees the form immediately on first contact.
  const declineForm = (r: Inquiry): string => {
    if (!r.id) return "";
    if (r.status === "declined") {
      return `<form method="POST" action="/admin/decline" style="display:inline">
        <input type="hidden" name="inquiry_id" value="${esc(r.id)}"/>
        <input type="hidden" name="action" value="reopen"/>
        <button type="submit" class="btn ghost" style="padding:6px 12px;font-size:11px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.04em" title="Status wieder auf 'neu' setzen">↺ Wieder öffnen</button>
      </form>`;
    }
    if (r.status === "new") {
      return `<details style="display:inline-block">
        <summary style="cursor:pointer;padding:6px 12px;font-size:11px;font-family:var(--font-mono);font-weight:600;color:var(--fg-3);text-transform:uppercase;letter-spacing:.04em;border:1px solid var(--line);border-radius:6px;user-select:none;list-style:none">Ablehnen</summary>
        <form method="POST" action="/admin/decline" style="display:flex;gap:6px;align-items:center;margin-top:8px;padding:10px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px" data-klar-confirm="Status wird auf 'abgelehnt' gesetzt. Mit ↺ jederzeit wieder öffnen." data-klar-confirm-title="Anfrage ablehnen?" data-klar-confirm-variant="warn" data-klar-confirm-ok="Ablehnen">
          <input type="hidden" name="inquiry_id" value="${esc(r.id)}"/>
          <input type="hidden" name="action" value="decline"/>
          <input type="text" name="reason" maxlength="280" placeholder="Grund (optional, intern)" style="padding:5px 8px;font-size:12px;background:var(--surface);border:1px solid var(--line);border-radius:5px;color:var(--fg);min-width:220px"/>
          <button type="submit" class="btn ghost" style="padding:5px 11px;font-size:11px">Ablehnen</button>
        </form>
      </details>`;
    }
    return "";
  };

  const actionBlock = (r: Inquiry): string => {
    // Declined: nur Reopen-Button + ggf. Reason-Hinweis.
    if (r.status === "declined") {
      const reasonLine = r.decline_reason
        ? `<div class="muted" style="margin-top:4px;font-size:11px;font-style:italic">Grund: ${esc(r.decline_reason)}</div>`
        : "";
      return `<div style="margin-top:14px;padding:10px 14px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="font-size:12px;color:var(--fg-3)">Abgelehnt${r.declined_at ? ` ${fmt(r.declined_at)}` : ""}.${reasonLine}</div>
        ${declineForm(r)}
      </div>`;
    }
    if (r.type !== "affiliate") {
      // Consulting/Coaching: nur Reject-Button (kein Approve-Flow).
      const fr = declineForm(r);
      return fr ? `<div style="margin-top:14px">${fr}</div>` : "";
    }

    if ((r.status === "invited" || r.status === "approved" || r.status === "active") && r.approved_app && r.approved_code) {
      const link = setupLinkFor(r.approved_app, r.approved_code);
      const isLive = r.status === "active";
      return `<div style="margin-top:14px;padding:12px 14px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          ${quietPill(`${isLive ? "active" : "invited"} · ${r.approved_app}`, isLive ? "success" : "info")}
          <a class="applink" style="font-family:ui-monospace,monospace;font-size:11px;word-break:break-all;flex:1;min-width:200px" href="${link}" target="_blank" rel="noopener">${link} ↗</a>
          <button type="button" class="btn ghost" style="padding:5px 11px;font-size:11px;flex-shrink:0" onclick="navigator.clipboard.writeText('${link}').then(()=>this.textContent='✓ kopiert').catch(()=>this.textContent='copy failed')">Copy link</button>
        </div>
        ${r.approved_at ? `<div class="muted" style="margin-top:6px;font-size:11px">Approved ${fmt(r.approved_at)}</div>` : ""}
      </div>`;
    }

    if (!r.id) return "";
    const displayName = r.handle || (r.email ?? "").split("@")[0] || "";
    const isNew = r.status === "new";
    return `<details style="margin-top:14px"${isNew ? " open" : ""}>
      <summary style="cursor:pointer;padding:8px 0;font-size:11px;color:var(--fg-2);font-weight:700;text-transform:uppercase;letter-spacing:0.6px;user-select:none">▸ Approve · Onboarding-Link generieren</summary>
      <form method="POST" action="/admin/approve" style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;padding:14px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;margin-top:6px">
        <input type="hidden" name="inquiry_id" value="${esc(r.id)}"/>
        <input type="hidden" name="email" value="${esc(r.email ?? "")}"/>
        <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">
          App ${r.target_app ? `<span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0">· wish: ${esc(r.target_app)}</span>` : ""}
          <select name="app" required style="margin-top:3px;padding:6px 8px;background:var(--surface);border:1px solid var(--line);border-radius:6px;color:var(--fg);font-size:13px">
            <option value="" ${r.target_app ? "" : "disabled selected"}>— wählen —</option>
            ${wiredOptionsFor(r.target_app)}
          </select>
        </label>
        <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">
          Handle
          <input type="text" name="handle" required maxlength="64" value="${esc((r.handle ?? "").replace(/^@/, ""))}" style="margin-top:3px;padding:6px 8px;background:var(--surface);border:1px solid var(--line);border-radius:6px;color:var(--fg);font-size:13px;width:140px"/>
        </label>
        <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">
          Display
          <input type="text" name="display_name" maxlength="64" value="${esc(displayName)}" style="margin-top:3px;padding:6px 8px;background:var(--surface);border:1px solid var(--line);border-radius:6px;color:var(--fg);font-size:13px;width:160px"/>
        </label>
        <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">
          Lang
          <select name="language" required style="margin-top:3px;padding:6px 8px;background:var(--surface);border:1px solid var(--line);border-radius:6px;color:var(--fg);font-size:13px;width:70px">
            <option value="de" selected>DE</option>
            <option value="en">EN</option>
            <option value="fr">FR</option>
            <option value="es">ES</option>
            <option value="it">IT</option>
          </select>
        </label>
        <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">
          Share %
          <input type="number" name="share_pct" min="1" max="100" step="1" value="50" style="margin-top:3px;padding:6px 8px;background:var(--surface);border:1px solid var(--line);border-radius:6px;color:var(--fg);font-size:13px;width:70px"/>
        </label>
        <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">
          Months
          <input type="number" name="share_months" min="1" max="60" step="1" value="24" style="margin-top:3px;padding:6px 8px;background:var(--surface);border:1px solid var(--line);border-radius:6px;color:var(--fg);font-size:13px;width:70px"/>
        </label>
        <button type="submit" class="btn" style="padding:8px 16px;font-size:13px">Onboarding-Link →</button>
      </form>
    </details>
    <div style="margin-top:10px">${declineForm(r)}</div>`;
  };

  // Status-Indikator oben rechts: gedämpfter Token-Ton, pulsierender Punkt nur
  // für "neu". Keine Emoji.
  const statusBadgeFor = (r: Inquiry): string => {
    const base = "display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;font-family:var(--font-mono);letter-spacing:.04em;text-transform:uppercase";
    if (r.status === "active") return `<span style="${base};color:var(--success)">active</span>`;
    if (r.status === "invited" || r.status === "approved") return `<span style="${base};color:var(--info)">invited</span>`;
    if (r.status === "new") return `<span style="${base};color:var(--warning)"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--warning);animation:klar-pulse 1.6s infinite"></span>neu</span>`;
    if (r.status === "declined") return `<span style="${base};color:var(--fg-4)">abgelehnt</span>`;
    return `<span style="font-size:11px;font-family:var(--font-mono);color:var(--fg-3);letter-spacing:.04em;text-transform:uppercase">${esc(r.status ?? "")}</span>`;
  };

  // Inline-Type-Badge: ruhiges Mono-Pill, neutral getönt.
  const typeBadgeMini = (t: string | undefined): string => {
    const label = t === "affiliate" ? "affiliate" : t === "consulting" ? "consulting" : (t ?? "—");
    return `<span style="font-family:var(--font-mono);font-size:10.5px;font-weight:600;color:var(--fg-2);background:var(--surface-2);border:1px solid var(--line);padding:3px 9px;border-radius:999px;letter-spacing:.02em">${esc(label)}</span>`;
  };

  // Initials-Avatar: ruhiger, token-basierter Neutral-Anker.
  const avatarFor = (email: string): string => {
    const local = (email || "?").split("@")[0] || "?";
    const letters = local.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || local.slice(0, 2).toUpperCase();
    return `<div aria-hidden="true" style="flex-shrink:0;width:44px;height:44px;border-radius:50%;background:var(--surface-2);color:var(--fg-2);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:700;font-size:14px;letter-spacing:0.02em">${esc(letters)}</div>`;
  };

  // Reply-Block für eine Inbox-Karte mit gematchtem Outreach-Target: voller
  // Mail-Body + Übersetzen + Antwort-Composer (Vorlage/frei → /admin/outreach/reply,
  // ändert den Status NICHT). Approve/Onboarding bleibt separat im actionBlock.
  let hasReplyComposer = false;
  const inboxReplyBlock = (r: Inquiry, t: OutreachTarget): string => {
    const tplLang = replyLang(t.language);
    const handle = ((t.handle || r.handle) ?? "").replace(/^@/, "");
    const name = t.display_name || r.handle || t.handle || "";
    const toEmail = ((t.contact_email || r.email) ?? "").toLowerCase().trim();
    const hasEmail = Boolean(toEmail);
    const def = REPLY_TEMPLATES[tplLang][0];
    const subst = (s: string): string => s.replace(/\{\{name\}\}/g, name).replace(/\{\{handle\}\}/g, handle);
    const cleanSub = (t.reply_subject ?? "").replace(/^re:\s*/i, "").trim();
    const defSubject = cleanSub ? `Re: ${cleanSub}` : subst(def.subject);
    const defBody = subst(def.body);
    const platLabel = t.platform === "tiktok" ? "TikTok" : t.platform === "instagram" ? "Instagram" : "";
    return `<div class="reply-card" data-name="${esc(name)}" data-handle="${esc(handle)}" style="margin-top:16px;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:14px 16px">
      <div style="font-family:var(--font-mono);font-size:9.5px;font-weight:500;text-transform:uppercase;letter-spacing:.08em;color:var(--fg-4);margin-bottom:8px">Antwort des Influencers${platLabel ? ` · ${platLabel}` : ""}</div>
      ${t.reply_subject ? `<div style="font-weight:600;font-size:12px;margin-bottom:4px">${esc(t.reply_subject)}</div>` : ""}
      <div class="reply-incoming" data-raw="${esc(`${t.reply_subject ? t.reply_subject + "\n\n" : ""}${t.last_message ?? ""}`.trim())}" data-src-lang="${esc(tplLang)}" style="white-space:pre-wrap;font-size:13px;color:var(--fg);font-family:var(--font-body)">${esc(t.last_message ?? "")}</div>
      <div style="margin-top:8px"><button type="button" class="btn ghost" style="padding:3px 9px;font-size:11px" onclick="klarTranslate(this)">DE übersetzen</button><div class="reply-trans muted" style="margin-top:6px;font-size:12px;white-space:pre-wrap"></div></div>
      <details style="margin-top:10px">
        <summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--fg-2);user-select:none">Antworten (Mail)</summary>
        <form method="POST" action="/admin/outreach/reply" style="margin-top:10px;display:flex;flex-direction:column;gap:8px" data-klar-confirm="Mail geht sofort an ${esc(toEmail)}. Reine Antwort, Approve/Onboarding-Link bleibt separat unten." data-klar-confirm-title="Antwort an @${esc(handle)} senden?" data-klar-confirm-ok="Senden">
          <input type="hidden" name="id" value="${esc(t.id)}"/>
          <input type="hidden" name="to" value="${esc(toEmail)}"/>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <label style="font-size:11px;color:var(--fg-3);display:inline-flex;align-items:center;gap:4px">Vorlage
              <select onchange="klarReplyFill(this)" style="padding:5px 8px;border:1px solid var(--line-strong);border-radius:5px;background:var(--bg);color:var(--fg);font-size:12px">
                ${replyTemplateSelectOptions(tplLang)}
              </select>
            </label>
            <span class="muted" style="font-size:11px">an ${hasEmail ? esc(toEmail) : "—"}</span>
          </div>
          <input type="text" name="subject" class="reply-subj" value="${esc(defSubject)}" maxlength="300" placeholder="Betreff" style="padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px"/>
          <textarea name="body" class="reply-text" rows="8" maxlength="8000" style="padding:8px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px;font-family:var(--font-body);resize:vertical">${esc(defBody)}</textarea>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button type="submit" class="btn" style="padding:6px 14px;font-size:12px"${hasEmail ? "" : " disabled title=\"keine Email\""}>Senden</button>
            <button type="button" class="btn ghost" style="padding:6px 12px;font-size:12px" onclick="klarCopyDraft(this)">Entwurf kopieren</button>
            ${hasEmail ? "" : `<span class="muted" style="font-size:11px;font-style:italic">keine Email, nutze "Entwurf kopieren"</span>`}
          </div>
        </form>
      </details>
    </div>`;
  };

  const renderCard = (r: Inquiry): string => {
    const details = detailPairs(r)
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v, isLong]) => `<div style="display:flex;gap:14px;font-size:13px;line-height:1.55;align-items:${isLong ? "flex-start" : "baseline"};padding:6px 0">
        <span style="min-width:88px;flex-shrink:0;font-family:var(--font-mono);font-weight:500;text-transform:uppercase;letter-spacing:.08em;font-size:9.5px;color:var(--fg-4);padding-top:${isLong ? "4px" : "0"}">${esc(k)}</span>
        <span style="color:var(--fg);flex:1;${isLong ? "white-space:pre-wrap;word-wrap:break-word" : ""}">${esc(v!)}</span>
      </div>`)
      .join("");

    const matched = matchTarget(r);
    let replyBlock = "";
    if (matched && (matched.last_message ?? "").trim()) {
      hasReplyComposer = true;
      replyBlock = inboxReplyBlock(r, matched);
    }

    const isNew = r.status === "new";
    const isDeclined = r.status === "declined";
    return `<article class="inbox-card" style="background:var(--surface);border:1px solid ${isNew ? "var(--line-strong)" : "var(--line)"};border-radius:14px;padding:${isDeclined ? "16px 22px" : "24px 26px"};margin:0;transition:border-color .15s,box-shadow .2s,opacity .15s;position:relative;${isNew ? "box-shadow:0 0 0 1px var(--line-strong) inset;" : ""}${isDeclined ? "opacity:.55;" : ""}">
      <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;flex-wrap:wrap;margin-bottom:18px">
        <div style="display:flex;gap:14px;align-items:center;flex:1;min-width:0">
          ${avatarFor(r.email ?? "")}
          <div style="min-width:0;flex:1">
            <a class="applink" href="mailto:${esc(r.email)}" style="font-family:var(--font-display);font-weight:700;font-size:16px;letter-spacing:-.01em;color:var(--fg);border:none;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.email)}</a>
            <div style="display:flex;align-items:center;gap:10px;margin-top:5px;flex-wrap:wrap">
              ${typeBadgeMini(r.type)}
              ${sourcePill(r.source)}
            </div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;text-align:right;flex-shrink:0">
          ${statusBadgeFor(r)}
          <span class="muted" style="font-size:11px;font-family:var(--font-mono);letter-spacing:.02em" title="${esc(fmt(r.created_at))}">${esc(fmtRelative(typeof r.created_at === "string" ? r.created_at : null))}</span>
        </div>
      </header>
      <div style="display:flex;flex-direction:column;gap:0">${details || `<span class="muted" style="font-size:12.5px;font-style:italic">keine weiteren Angaben</span>`}</div>
      ${replyBlock}
      ${actionBlock(r)}
    </article>`;
  };

  const buildToggleHref = (target: "declined" | "tests") => {
    const base = `/admin?view=inbox`;
    const parts: string[] = [];
    if (effectiveType !== "all") parts.push(`type=${effectiveType}`);
    if (effectiveSource !== "all") parts.push(`source=${encodeURIComponent(effectiveSource)}`);
    if (target === "declined" ? !showDeclined : showDeclined) parts.push("show_declined=1");
    if (target === "tests" ? !showTests : showTests) parts.push("show_tests=1");
    return parts.length ? `${base}&${parts.join("&")}` : base;
  };
  const declinedToggle = nDeclined > 0
    ? `<div style="margin-top:16px;padding:12px 16px;background:var(--surface-2);border:1px dashed var(--line);border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <span class="muted" style="font-size:12px;font-family:var(--font-mono);letter-spacing:.04em">${showDeclined ? "✕" : "•"} ${nDeclined} abgelehnt${showDeclined ? " (eingeblendet)" : " (versteckt)"}</span>
        <a class="applink" href="${buildToggleHref("declined")}" style="font-size:12px">${showDeclined ? "verstecken" : "zeigen"} →</a>
      </div>`
    : "";
  const testsToggle = nTests > 0
    ? `<div style="margin-top:10px;padding:12px 16px;background:var(--surface-2);border:1px dashed var(--line);border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <span class="muted" style="font-size:12px;font-family:var(--font-mono);letter-spacing:.04em">${showTests ? "⚙" : "•"} ${nTests} Test-Eintrag${nTests === 1 ? "" : "e"}${showTests ? " (eingeblendet)" : " (versteckt)"}</span>
        <a class="applink" href="${buildToggleHref("tests")}" style="font-size:12px">${showTests ? "verstecken" : "zeigen"} →</a>
      </div>`
    : "";

  const body = rows.length
    ? `<div style="display:flex;flex-direction:column;gap:14px;margin-top:8px">${rows.map(renderCard).join("")}</div>${testsToggle}${declinedToggle}`
    : `<div style="background:var(--surface);border:1px dashed var(--line);border-radius:14px;padding:48px 24px;text-align:center"><div style="font-family:var(--font-mono);font-size:11px;color:var(--fg-4);letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px">leer</div><span class="muted" style="font-size:13px">Keine Anfragen in dieser Auswahl.${effectiveType !== "all" || effectiveSource !== "all" ? ` <a class="applink" href="/admin?view=inbox">Filter zurücksetzen</a>` : ""}</span></div>${testsToggle}${declinedToggle}`;

  const consultingHint = effectiveType === "consulting"
    ? `<p class="sub muted" style="margin:0 0 16px;font-size:13px">Consulting-Calls aus Cal.com (consulting + coaching event types) erscheinen unter <a class="applink" href="/admin?view=bookings">Bookings</a>. Hier nur die schriftlichen Anfragen vom Kontaktformular.</p>`
    : "";

  const html = `<style>
    @keyframes klar-pulse { 0%,100% { box-shadow: 0 0 0 0 #eab308a0; } 50% { box-shadow: 0 0 0 4px transparent; } }
    .inbox-card:hover { border-color: var(--line-strong); box-shadow: var(--shadow); }
    .inbox-card details[open] summary { color: var(--fg); }
  </style><h1>Inbox</h1><p class="sub">Affiliate- und Consulting-Anfragen, gefiltert nach Typ und Quelle. Affiliate-Karten haben den <em>Approve</em>-Klappbereich für den Onboarding-Link, bei neuen Anfragen ist er aufgeklappt. Outreach-Replies zeigen den vollen Mail-Text mit Übersetzen + Antwort-Composer direkt auf der Karte.</p>
    ${typeTabs}
    ${sourceFilters}
    ${consultingHint}
    ${cards}
    ${body}`;
  return { html, hasReplyComposer };
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; source?: string; show_declined?: string; show_tests?: string; msg?: string }>;
}) {
  // Auth — identical gate to brain/cal/bookings/revenue (device cookie + admin session).
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) redirect("/admin/login");
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const device = await verifyDeviceCookie(readCookieFromString(cookieHeader, "klar_device"), DEV);
  if (!device) redirect("/admin/login");
  if (readCookieFromString(cookieHeader, "klar_admin") !== KEY) redirect("/admin/login");

  const sp = await searchParams;
  const typeFilter = sp.type ?? "all";
  const sourceFilter = sp.source ?? "all";
  const showDeclined = sp.show_declined === "1";
  const showTests = sp.show_tests === "1";

  const apps = getApps();
  const { html: main, hasReplyComposer } = await inboxMain(typeFilter, sourceFilter, showDeclined, showTests);
  const flash = sp.msg ? `<div class="flash">${esc(sp.msg)}</div>` : "";
  const sidebar = adminSidebar("postfach", apps);
  const topbar = `
    <span class="crumb"><b>Inbox</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>Inbox · Klar Control</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={FONTS_LINK} rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_TOGGLE_SCRIPT }} />
      <canvas id="klar-smoke-bg" aria-hidden="true" suppressHydrationWarning />
      <div className="klar-aurora" aria-hidden="true" />
      <div dangerouslySetInnerHTML={{ __html: GLASS_SVG_DEFS }} />
      <div dangerouslySetInnerHTML={{ __html: MODAL_HTML }} />
      <div className="layout">
        <aside className="side" dangerouslySetInnerHTML={{ __html: sidebar }} />
        <main className="main">
          <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
          <div dangerouslySetInnerHTML={{ __html: mailTabs("inbox") }} />
          <div className="content" dangerouslySetInnerHTML={{ __html: flash + main }} />
        </main>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SMOKE_BG_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: MODAL_SCRIPT }} />
      {hasReplyComposer ? <script dangerouslySetInnerHTML={{ __html: REPLY_INBOX_JS }} /> : null}
    </>
  );
}
