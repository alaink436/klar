// POST handler for API tokens (scopes brain:read, learnings:read, vault:use).
//   action=create         -> mint a token, render it ONCE on a confirmation page
//                            (never in a URL param, never retrievable again)
//   action=revoke|delete  -> revoke or delete by id
//   action=secrets        -> which vault keys a token may read in plaintext
// The other actions redirect back to /admin/brain (JSON with ?json=1). Admin
// check via lib/adminGuard, like every admin route.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { FONTS_LINK, THEME_INIT_SCRIPT, esc } from "@/app/admin/_shared";
import { requireAdminRoute } from "@/lib/adminGuard";
import {
  createToken,
  revokeToken,
  deleteToken,
  setTokenSecrets,
  setSecretsOnAllTokens,
  type Scope,
} from "@/lib/apiTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backWith(req: NextRequest, params: Record<string, string>): Response {
  const url = new URL("/admin/brain", req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

// This page renders its own HTML, outside the admin layout, so it inlines the
// design file itself (shipped with the function, see next.config.ts). Read on
// each call: the token is already minted at this point, and a missing file
// must cost the styling, not the one chance to copy the token.
// It uses only the building blocks from that file (`.klar-karte`, the pills,
// `.klar-marke`), no Tailwind: utilities are not part of the raw file.
function adminCss(): string {
  try {
    return readFileSync(join(process.cwd(), "src/app/admin/admin.css"), "utf8");
  } catch {
    return "";
  }
}

function tokenShownOncePage(raw: string, label: string, scopes: string[]): Response {
  const body = `<!doctype html><html lang="de" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Token erstellt · Klar Control</title>
<script>${THEME_INIT_SCRIPT}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS_LINK}" rel="stylesheet"><style>:root{--font-geist-sans:"Geist";--font-geist-mono:"Geist Mono"}${adminCss()}</style></head><body>
<div style="position:relative;isolation:isolate;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">
  <div class="klar-hintergrund" aria-hidden="true"><svg style="position:absolute;inset:0;width:100%;height:100%"><defs><pattern id="raster" width="56" height="56" patternUnits="userSpaceOnUse" x="-1" y="-1"><path d="M.5 56V.5H56" style="fill:none;stroke:var(--grid-line)"/></pattern></defs><rect width="100%" height="100%" fill="url(#raster)"/></svg></div>
  <div class="klar-karte" style="width:100%;max-width:560px;padding:34px 32px 26px">
    <span class="klar-marke">Klar Control · API-Token</span>
    <h1 style="font-size:40px;margin:18px 0 10px">Einmal sichtbar</h1>
    <p style="margin:0 0 24px;font-size:13.5px;line-height:1.6;color:var(--fg-3)">Kopiere den Token jetzt. Er wird nur gehasht gespeichert und ist danach nicht mehr abrufbar.</p>
    <div style="margin:0 0 8px;font-family:var(--font-mono);font-size:10px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--fg-3)">Token · ${esc(label)} · ${esc(scopes.join(", "))}</div>
    <code id="tok" style="display:block;font-family:var(--font-mono);font-size:13px;background:rgba(0,0,0,.4);border:1px solid var(--line);border-radius:var(--radius-sm);padding:14px 16px;color:var(--fg);word-break:break-all;line-height:1.5">${esc(raw)}</code>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:18px">
      <button type="button" class="klar-pille klar-pille-hell" style="height:36px;padding:0 18px;border:0;font-size:13px" onclick="navigator.clipboard.writeText(document.getElementById('tok').textContent).then(()=>{this.textContent='✓ Kopiert'}).catch(()=>{this.textContent='Copy fehlgeschlagen'})">Token kopieren</button>
      <a class="klar-pille klar-pille-dunkel" style="height:36px;padding:0 18px;font-size:13px" href="/admin/brain">Fertig, zurück</a>
    </div>
    <div class="klar-trenner" style="margin:24px 0 14px"></div>
    <span style="font-family:var(--font-mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--fg-4)">Nutzung: Authorization: Bearer &lt;token&gt;</span>
  </div>
</div>
</body></html>`;
  return new Response(body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdminRoute(req, "login");
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return backWith(req, { err: "bad form" });
  }

  const action = String(form.get("action") ?? "").trim();
  // The Zugang UI calls revoke/delete via fetch(?json=1) so it can soft-refresh
  // (router.refresh) in place instead of a full redirect. The plain form-post
  // path (redirect back to /admin/brain) stays as the no-JS fallback.
  const wantsJson = new URL(req.url).searchParams.get("json") === "1";

  if (action === "revoke" || action === "delete") {
    const id = String(form.get("id") ?? "").trim();
    if (!id) {
      return wantsJson
        ? NextResponse.json({ ok: false, error: "kein Token angegeben" }, { status: 400 })
        : backWith(req, { err: "kein Token angegeben" });
    }
    const ok = action === "revoke" ? await revokeToken(id) : await deleteToken(id);
    const okMsg = action === "revoke" ? "Token widerrufen." : "Token gelöscht.";
    const errMsg = action === "revoke" ? "Widerruf fehlgeschlagen." : "Löschen fehlgeschlagen.";
    if (wantsJson) {
      return NextResponse.json(ok ? { ok: true, msg: okMsg } : { ok: false, error: errMsg }, { status: ok ? 200 : 500 });
    }
    return backWith(req, ok ? { msg: okMsg } : { err: errMsg });
  }

  // Klartext-Freigabe an einem BESTEHENDEN Token. Das ist der uebliche Weg:
  // der Token liegt laengst auf dem Geraet, hier kommt nur dazu, welche Keys er
  // im Klartext holen darf. Eine leere Auswahl nimmt die Freigabe wieder weg.
  if (action === "secrets") {
    const id = String(form.get("id") ?? "").trim();
    if (!id) {
      return wantsJson
        ? NextResponse.json({ ok: false, error: "kein Token angegeben" }, { status: 400 })
        : backWith(req, { err: "kein Token angegeben" });
    }
    const secretIds = form
      .getAll("secret_id")
      .map((v) => String(v).trim())
      .filter(Boolean);

    // Frist in Stunden; "" oder 0 heisst unbefristet. Der Zeitpunkt wird hier
    // gerechnet, nicht im Browser, damit eine falsch gestellte Uhr am Client
    // keine laengere Freigabe erzeugt als gemeint.
    const hours = Number(String(form.get("until_hours") ?? "").trim());
    const until =
      Number.isFinite(hours) && hours > 0
        ? new Date(Date.now() + hours * 3_600_000).toISOString()
        : null;

    // "Auf allen Geräten": dieselbe Freigabe auf jeden aktiven vault:use-Token.
    // Der Vault ist geraeteweise zugaenglich, sonst waere es ein Klick je Zeile.
    const allDevices = form.get("all_devices") != null;

    const ok = allDevices
      ? (await setSecretsOnAllTokens(secretIds, until)) > 0
      : await setTokenSecrets(id, secretIds, until);

    const wo = allDevices ? " auf allen Geräten" : "";
    const frist = until ? ` für ${hours} Stunde${hours === 1 ? "" : "n"}` : "";
    const okMsg = secretIds.length
      ? `${secretIds.length} Key${secretIds.length === 1 ? "" : "s"}${wo}${frist} freigegeben.`
      : `Klartext-Freigabe entzogen${wo}.`;
    if (wantsJson) {
      return NextResponse.json(
        ok ? { ok: true, msg: okMsg } : { ok: false, error: "Freigabe fehlgeschlagen." },
        { status: ok ? 200 : 500 },
      );
    }
    return backWith(req, ok ? { msg: okMsg } : { err: "Freigabe fehlgeschlagen." });
  }

  if (action === "create") {
    const label = String(form.get("label") ?? "").trim();
    const scopes: Scope[] = [];
    if (form.get("scope_brain") != null) scopes.push("brain:read");
    if (form.get("scope_learnings") != null) scopes.push("learnings:read");
    if (form.get("scope_vault") != null) scopes.push("vault:use");
    if (scopes.length === 0) return backWith(req, { err: "Mindestens einen Scope wählen." });

    // Optional: Keys, die dieser Token gleich im Klartext holen darf. Leer ist
    // der Normalfall und kein Fehler; freigegeben wird sonst spaeter per
    // action=secrets an einem bestehenden Token.
    const secretIds = form
      .getAll("secret_id")
      .map((v) => String(v).trim())
      .filter(Boolean);
    const r = await createToken(label, scopes, secretIds);
    if (!r.ok) return backWith(req, { err: r.error });
    return tokenShownOncePage(r.raw, label || "Unbenannt", scopes);
  }

  return backWith(req, { err: `unbekannte Aktion: ${action || "(leer)"}` });
}
