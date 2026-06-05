// AI-Brain export API — token-gated, read-only full-context dump of the
// AI-Brain vault so a remote agent (Claude Code on another machine) can load
// the whole brain as context.
//
// Auth:   Authorization: Bearer <BRAIN_API_TOKEN>   (constant-time compare)
// Source: the private repo alaink436/AI-Brain, fetched once as a tarball via
//         BRAIN_GITHUB_TOKEN (the same fine-grained PAT the /brain viewer uses).
// Guard:  the Secrets/ and Credentials/ top-level folders are NEVER included,
//         mirroring brainVault.HIDDEN_FOLDERS.
//
// GET /api/brain/export          -> JSON { repo, ref, count, notes:[{path,content}] }
// GET /api/brain/export?format=md -> one concatenated markdown doc (path headers)
//
// Env: BRAIN_API_TOKEN (the access token you hand to the remote agent),
//      BRAIN_GITHUB_TOKEN (repo read PAT, already used by the brain viewer).

import { parseTarGzip } from "nanotar";
import { clientIp, rateLimit } from "../../../../lib/apiGuards";
import { verifyToken, hasStore } from "../../../../lib/apiTokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REPO = "alaink436/AI-Brain";
const BRANCH = "master";
const HIDDEN = ["Secrets", "Credentials"];

const ghToken = () => process.env.BRAIN_GITHUB_TOKEN ?? "";
const apiToken = () => process.env.BRAIN_API_TOKEN ?? "";

function topFolder(p: string): string {
  const c = p.replace(/^\/+/, "");
  const i = c.indexOf("/");
  return i === -1 ? "_root" : c.slice(0, i);
}

function ctEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  if (x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
}

function bearer(req: Request): string {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : "";
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(req: Request): Promise<Response> {
  if (!ghToken()) return json({ error: "BRAIN_GITHUB_TOKEN not configured" }, 503);
  const envTok = apiToken();
  if (!envTok && !hasStore()) {
    return json({ error: "no auth configured (BRAIN_API_TOKEN or token store)" }, 503);
  }

  // Rate-limit: 30 exports per hour per IP (each pull fetches the whole repo).
  const rl = rateLimit("brain_export", clientIp(req), 30, 60 * 60 * 1000);
  if (!rl.ok) return json({ error: "rate limited", retryAfterSeconds: rl.retryAfterSeconds }, 429);

  // V2 auth: a DB token with scope brain:read, OR the legacy env token.
  const tok = bearer(req);
  let authed = false;
  if (tok && envTok && ctEqual(tok, envTok)) authed = true;
  else if (tok) authed = Boolean(await verifyToken(tok, "brain:read"));
  if (!authed) return json({ error: "unauthorized" }, 401);

  // One call: the whole repo as a gzipped tarball.
  const res = await fetch(`https://api.github.com/repos/${REPO}/tarball/${BRANCH}`, {
    headers: {
      Authorization: `Bearer ${ghToken()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    next: { revalidate: 300 },
  });
  if (!res.ok) return json({ error: "github fetch failed", status: res.status }, 502);

  const buf = new Uint8Array(await res.arrayBuffer());
  let files;
  try {
    files = await parseTarGzip(buf);
  } catch {
    return json({ error: "failed to unpack archive" }, 502);
  }

  const dec = new TextDecoder();
  const notes: { path: string; content: string }[] = [];
  for (const f of files) {
    // GitHub wraps everything in "<owner>-<repo>-<sha>/..." — strip that prefix.
    const rel = f.name.replace(/^[^/]+\//, "");
    if (!rel || !rel.toLowerCase().endsWith(".md")) continue; // notes only (skips dirs)
    if (HIDDEN.includes(topFolder(rel))) continue; // never expose secrets
    notes.push({ path: rel, content: f.data ? dec.decode(f.data) : "" });
  }
  notes.sort((a, b) => a.path.localeCompare(b.path));

  if (new URL(req.url).searchParams.get("format") === "md") {
    const md = notes
      .map((n) => `\n\n${"=".repeat(8)} ${n.path} ${"=".repeat(8)}\n\n${n.content}`)
      .join("")
      .trimStart();
    return new Response(md, {
      status: 200,
      headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  return json({ repo: REPO, ref: BRANCH, count: notes.length, notes });
}
