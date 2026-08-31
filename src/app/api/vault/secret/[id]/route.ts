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
// Damit faellt fuer diesen einen Pfad das "use but don't see". Die Schranke ist
// deshalb nicht der Scope, sondern die Freigabeliste am Token
// (`api_tokens.vault_secret_ids`):
//
//   1. Sie ist leer, solange niemand sie fuellt. Jeder bestehende vault:use-Token
//      kann hier also nichts, bis Alain in Klar Control ein Kaestchen anhakt. Ein
//      zweiter Token waere eine zusaetzliche Datei ohne zusaetzliche Sicherheit:
//      auch er laege im Klartext auf demselben Rechner.
//   2. Sie gilt absolut, auch fuer den "*"-Scope. Ein Token kann nie mehr als die
//      Keys, die ihm einzeln zugeteilt wurden. Das Anhaken ist der bewusste Akt,
//      nicht das Erzeugen des Tokens.
//   3. Sie kann befristet sein (`vault_release_until`). Nach Ablauf zaehlt sie
//      wie leer, ohne dass jemand daran denken muss. Die Liste selbst bleibt
//      stehen, damit im Dashboard sichtbar ist, was einmal offen war.
//   4. Widerrufene Secrets sind weg (revealForExec prueft revoked_at), anders als
//      beim Admin-Reveal, der hinter 2FA sitzt und auch Altes zeigen darf.
//   5. Jeder Zugriff stempelt Token und Secret, damit im Dashboard sichtbar ist,
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

  const auth = await verifyToken(tok, "vault:use", { touch: false });
  if (!auth) return json({ error: "unauthorized" }, 401);

  // Die Freigabeliste ist die eigentliche Schranke. Sie steht deshalb als
  // eigener Check hier und nicht in verifyToken(), wo ein "*"-Scope sie
  // aushebeln wuerde.
  if (!auth.vaultSecretIds.includes(id)) {
    // Abgelaufen und nie freigegeben sind beide 403, aber nicht dasselbe
    // Problem: das eine loest ein neues Haekchen, das andere eine neue Frist.
    return json(
      auth.releaseExpired
        ? { error: "plaintext release expired for this token", expiredAt: auth.releaseUntil, id }
        : { error: "secret not released for this token", id },
      403,
    );
  }

  const secret = await revealForExec(id);
  if (!secret) return json({ error: "unknown or revoked secret" }, 404);

  touchTokenUsed(auth.id);
  touchSecretUsed(id);

  return json({ ok: true, id, secret });
}
