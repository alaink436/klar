// POST handler for API-token management (Brain-API V2 + future Vault).
//   action=create  -> mint a token, render it ONCE on a confirmation page
//                     (never in a URL param, never retrievable again)
//   action=revoke  -> revoke by id, redirect back to /admin/settings
//
// Same admin auth as /admin/settings/save (device cookie + admin session).

import { NextResponse, type NextRequest } from "next/server";
import { ctEqual, readCookie, STYLE, FONTS_LINK, THEME_INIT_SCRIPT, esc } from "@/app/admin/_shared";
import { verifyDeviceCookie } from "@/lib/deviceCookie";
import { createToken, revokeToken, type Scope } from "@/lib/apiTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backWith(req: NextRequest, params: Record<string, string>): Response {
  const url = new URL("/admin/brain", req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

function tokenShownOncePage(raw: string, label: string, scopes: string[]): Response {
  const body = `<!doctype html><html lang="de" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Token erstellt · Klar Control</title>
<script>${THEME_INIT_SCRIPT}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS_LINK}" rel="stylesheet"><style>${STYLE}</style></head><body>
<div class="login">
  <div class="login-card" style="max-width:560px">
    <div class="login-head">
      <div class="login-head-text">
        <span class="login-eyebrow">Klar Control · API-Token</span>
        <span class="login-mark">Einmal sichtbar<span class="dot">.</span></span>
      </div>
    </div>
    <p class="login-tag">Kopiere den Token jetzt. Er wird nur gehasht gespeichert und ist danach nicht mehr abrufbar.</p>
    <div class="login-field">
      <label class="login-label">Token · ${esc(label)} · ${esc(scopes.join(", "))}</label>
      <code id="tok" style="display:block;font-family:var(--font-mono);font-size:13px;background:var(--surface-2);border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:14px 16px;color:var(--fg);word-break:break-all;line-height:1.5">${esc(raw)}</code>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button type="button" class="btn pop" onclick="navigator.clipboard.writeText(document.getElementById('tok').textContent).then(()=>{this.textContent='✓ Kopiert'}).catch(()=>{this.textContent='Copy fehlgeschlagen'})">Token kopieren</button>
      <a class="btn ghost" href="/admin/brain">Fertig, zurück</a>
    </div>
    <div class="login-foot"><span class="login-foot-text">Nutzung: Authorization: Bearer &lt;token&gt;</span></div>
  </div>
</div>
</body></html>`;
  return new Response(body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  if (!KEY || !DEV) return NextResponse.json({ ok: false, error: "admin not configured" }, { status: 503 });
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.redirect(new URL("/admin/login?next=/admin/brain", req.url), 303);
  }
  const device = await verifyDeviceCookie(readCookie(req, "klar_device"), DEV);
  if (!device) {
    return NextResponse.redirect(new URL("/admin/login?next=/admin/brain", req.url), 303);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return backWith(req, { err: "bad form" });
  }

  const action = String(form.get("action") ?? "").trim();

  if (action === "revoke") {
    const id = String(form.get("id") ?? "").trim();
    if (!id) return backWith(req, { err: "kein Token angegeben" });
    const ok = await revokeToken(id);
    return backWith(req, ok ? { msg: "Token widerrufen." } : { err: "Widerruf fehlgeschlagen." });
  }

  if (action === "create") {
    const label = String(form.get("label") ?? "").trim();
    const scopes: Scope[] = [];
    if (form.get("scope_brain") != null) scopes.push("brain:read");
    if (form.get("scope_vault") != null) scopes.push("vault:use");
    if (scopes.length === 0) return backWith(req, { err: "Mindestens einen Scope wählen." });
    const r = await createToken(label, scopes);
    if (!r.ok) return backWith(req, { err: r.error });
    return tokenShownOncePage(r.raw, label || "Unbenannt", scopes);
  }

  return backWith(req, { err: `unbekannte Aktion: ${action || "(leer)"}` });
}
