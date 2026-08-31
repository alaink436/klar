// Vault exec — der Ausweg fuer CLIs, die der Proxy nicht bedienen kann.
//
//   GET /api/vault/secret/<secretId>   ->   { ok: true, secret: "<klartext>" }
//
// Der Normalfall bleibt der Proxy nebenan: der haengt den Key serverseitig an
// den Request und gibt ihn nie heraus. Das traegt aber nur ueber HTTP. Ein CLI
// wie `eas`, `vercel` oder `gh` liest seinen Key aus einer Env-Var und hat
// keinen Base-URL-Schalter, mit dem man es hierher umbiegen koennte. Fuer genau
// diese Faelle gibt dieser Endpunkt den Klartext heraus, an den Wrapper
// `klar-run.sh` / `klar-run.ps1`, der ihn ausschliesslich in die Environment
// eines Kindprozesses schreibt und danach wegwirft.
//
// Damit faellt fuer diesen einen Pfad das "use but don't see", und die Schranken
// sind entsprechend enger als beim Proxy:
//
//   1. Eigener Scope `vault:exec`. Ein vault:use-Token kommt hier nicht durch,
//      und ein exec-Token gehoert nie auf dasselbe Token wie vault:use.
//   2. Allow-List je Token (`api_tokens.vault_secret_ids`). Sie wird NACH dem
//      Scope geprueft und gilt absolut: ein Token ohne Eintrag fuer diese id
//      bekommt nichts, auch mit dem "*"-Scope. Ein exec-Token ist damit nie ein
//      Generalschluessel ueber den Vault, sondern immer nur ueber die Keys, die
//      Alain ihm einzeln zugeteilt hat.
//   3. Widerrufene Secrets sind weg (revealForExec prueft revoked_at) — anders
//      als beim Admin-Reveal, der hinter 2FA sitzt und auch Altes zeigen darf.
//   4. Jeder Zugriff stempelt Token und Secret, damit im Dashboard sichtbar ist,
//      dass ein Key im Klartext rausging.
//
// Nur Authorization: Bearer. Die x-api-key-Bequemlichkeit des Proxys gilt hier
// bewusst nicht: dieser Pfad soll nicht versehentlich von einem SDK getroffen
// werden, dessen Base-URL jemand umgebogen hat.

import { verifyToken, touchTokenUsed } from "@/lib/apiTokens";
import { revealForExec, vaultReady, touchSecretUsed } from "@/lib/vault";
import { clientIp, rateLimit } from "@/lib/apiGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Ein Aufruf entspricht einem CLI-Kommando, nicht einem API-Request — 60 in 10
// Minuten deckt auch eine Schleife ueber mehrere Projekte, ohne dass ein
// durchgedrehtes Skript den ganzen Vault in Serie abholen kann.
const EXEC_MAX = 60;
const EXEC_WINDOW_MS = 10 * 60 * 1000;

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!vaultReady()) return json({ error: "vault not configured" }, 503);

  const rl = rateLimit("vault_exec", clientIp(req), EXEC_MAX, EXEC_WINDOW_MS);
  if (!rl.ok) return json({ error: "rate limited", retryAfterSeconds: rl.retryAfterSeconds }, 429);

  const m = /^Bearer\s+(.+)$/i.exec((req.headers.get("authorization") ?? "").trim());
  const tok = m ? m[1].trim() : "";
  if (!tok) return json({ error: "unauthorized" }, 401);

  const { id } = await ctx.params;

  const auth = await verifyToken(tok, "vault:exec", { touch: false });
  if (!auth) return json({ error: "unauthorized" }, 401);

  // Die Allow-List ist die eigentliche Schranke, nicht der Scope. Sie steht
  // deshalb als eigener Check hier und nicht in verifyToken(), wo ein "*"-Scope
  // sie aushebeln wuerde.
  if (!auth.vaultSecretIds.includes(id)) {
    return json(
      { error: "secret not in this token's allow-list", id },
      403,
    );
  }

  const secret = await revealForExec(id);
  if (!secret) return json({ error: "unknown or revoked secret" }, 404);

  touchTokenUsed(auth.id);
  touchSecretUsed(id);

  return json({ ok: true, id, secret });
}
