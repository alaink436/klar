// SERVER-side builder for the "Agent-Briefing" — a self-contained prompt the
// admin copies from /admin/brain (Zugang) and pastes into an LLM agent (Claude
// Code) on ANY device so it can use the Klar Vault gateway right away, without
// the Supabase MCP (to discover secret ids) or the PowerShell wrapper.
//
// Contains NO secrets: the vault:use token is referenced as an env var /
// secrets-file the agent reads at call time, never embedded here. Safe to render
// in the (2FA-gated) admin UI and to paste into any agent prompt.

export interface BriefingSecret {
  id: string;
  label: string;
  provider: string;
  baseUrl: string; // only proxyable secrets (non-empty base_url) are listed
  authHeader: string;
  authScheme: string;
}

// A sensible example sub-path per provider, appended after base_url. Only a hint
// for the agent; the real path depends on the call. Unknown providers fall back
// to a placeholder.
const EXAMPLE_PATH: Record<string, string> = {
  anthropic: "v1/messages",
  openai: "v1/chat/completions",
  google: "v1beta/models",
  mistral: "v1/chat/completions",
  groq: "chat/completions",
  openrouter: "chat/completions",
  perplexity: "chat/completions",
  xai: "v1/chat/completions",
  deepseek: "chat/completions",
  github: "user",
  vercel: "v9/projects",
  brevo: "smtp/email",
  resend: "emails",
  sendgrid: "v3/mail/send",
  stripe: "v1/customers",
  revenuecat: "v1/subscribers",
  n8n: "workflows",
  apify: "acts",
  wise: "v1/profiles",
};

function examplePath(provider: string): string {
  return EXAMPLE_PATH[provider.trim().toLowerCase()] ?? "";
}

// Build the full briefing as a Markdown string. `origin` is the public origin of
// the dashboard (e.g. https://getklar.org); `secrets` is the full vault list —
// store-only entries (no base_url) are filtered out here.
export function buildAgentBriefing({
  origin,
  secrets,
}: {
  origin: string;
  secrets: BriefingSecret[];
}): string {
  const proxyable = secrets.filter((s) => s.baseUrl);

  // Concrete example: prefer an Anthropic key, then OpenAI, then the first one.
  const pick =
    proxyable.find((s) => s.provider.trim().toLowerCase() === "anthropic") ??
    proxyable.find((s) => s.provider.trim().toLowerCase() === "openai") ??
    proxyable[0];
  const exId = pick?.id ?? "<secret-id>";
  const exPath = pick ? examplePath(pick.provider) || "<provider-pfad>" : "v1/...";
  const isAnthropic = pick?.provider.trim().toLowerCase() === "anthropic";

  // Build the GET example from a header list joined with ` \<newline>  ` so the
  // last line never carries a dangling backslash (which would break the shell
  // line-continuation when no extra header follows).
  const getHeaders = [`-H "Authorization: Bearer $KLAR_VAULT_TOKEN"`];
  if (isAnthropic) getHeaders.push(`-H "anthropic-version: 2023-06-01"`);
  const getCurl = [`curl -s ${origin}/api/vault/proxy/${exId}/${exPath}`, ...getHeaders].join(" \\\n  ");

  const table = proxyable.length
    ? [
        "| Label | Provider | Secret-ID (für die URL) | Base-URL | Beispiel-Pfad |",
        "|---|---|---|---|---|",
        ...proxyable.map(
          (s) =>
            `| ${s.label} | ${s.provider} | ${s.id} | ${s.baseUrl} | ${
              examplePath(s.provider) || "<provider-pfad>"
            } |`,
        ),
      ].join("\n")
    : "_(Noch keine proxybaren Keys im Vault — lege im Vault einen Key MIT Base-URL an, dann erscheinen sie hier.)_";

  return `# Klar Vault Gateway — Agent-Briefing

Du hast Zugriff auf den **Klar Vault API-Gateway**. Darüber nutzt du echte API-Keys
(Anthropic, OpenAI, GitHub, n8n, …), **ohne den Klartext-Key je zu sehen**: Der
Gateway entschlüsselt den passenden Key serverseitig, hängt ihn an den
Upstream-Request und streamt die Antwort zurück. Du brauchst dafür nur **einen**
Zugangs-Token (Scope \`vault:use\`).

## Endpoint & Auth
- **URL-Schema:** \`${origin}/api/vault/proxy/<secret-id>/<provider-pfad>\`
- **Header:** \`Authorization: Bearer <KLAR_VAULT_TOKEN>\`
- Der Token steht **nicht** in diesem Prompt. Lies ihn zur Laufzeit aus der
  Umgebungsvariable \`KLAR_VAULT_TOKEN\` oder der Datei \`~/.secrets/klar-vault-token\`.
  **Gib ihn nie im Chat/Log/Commit aus.**
- Token noch nicht hinterlegt? Alain mintet einen unter
  \`${origin}/admin\` → **AI-Brain → Zugang → „Token erzeugen"** (Scope
  \`vault:use\`), legt ihn auf diesem Gerät in \`KLAR_VAULT_TOKEN\` bzw.
  \`~/.secrets/klar-vault-token\` ab — ohne ihn in einen Chat zu pasten.

## Verfügbare Secrets (live aus dem Vault)
${table}

> Nur diese \`base_url\`-Einträge sind über den Gateway nutzbar. Store-only-Keys
> (ohne Base-URL) gehen nicht über den Proxy.

## Aufruf — plattformunabhängig (curl)
\`\`\`bash
# GET (Beispiel${pick ? `: ${pick.label}` : ""})
${getCurl}

# POST mit JSON-Body (Pfad + Body je nach Provider)
curl -s ${origin}/api/vault/proxy/<secret-id>/<provider-pfad> \\
  -H "Authorization: Bearer $KLAR_VAULT_TOKEN" \\
  -H "content-type: application/json" \\
  -d '{ "…": "…" }'
\`\`\`

Auf Alains Windows-PC geht stattdessen der Wrapper (liest den Token selbst aus der
Datei, gibt ihn nie aus):
\`\`\`powershell
& "$HOME\\AI-Brain\\Infrastructure\\klar-vault.ps1" -Id <secret-id> -Path '${exPath}' -Method POST -Body @{ }
\`\`\`

## Regeln
- Der Gateway leitet upstream nur eine **Header-Allowlist** weiter:
  \`content-type\`, \`accept\`, \`user-agent\`, \`anthropic-version\`,
  \`openai-organization\`. Andere Header brauchst du nicht — die Provider-Auth
  setzt der Gateway selbst.
- Deinen \`Authorization\`-Header (den \`vault:use\`-Token) leitet der Gateway
  **nie** an den Upstream weiter.
- **Rate-Limit:** 120 Requests / Stunde / IP.
- **Fehlercodes:** \`401\` Token fehlt/ungültig/kein \`vault:use\` · \`404\`
  falsche oder widerrufene Secret-ID · \`429\` Rate-Limit · \`502\` Upstream nicht
  erreichbar · \`503\` Vault aus.
- Token nie in Chat, Git, Logs oder \`echo\`. Bei Leak: Dashboard → Token
  **widerrufen + neu erzeugen**.
`;
}

// Build the read-only "Learnings / RAG" briefing for a brain:read token. Unlike
// the vault briefing this exposes NO secrets and no gateway — only the
// token-gated brain export endpoint that streams every non-secret note
// (Learnings, Projects, STATUS …) as Markdown or JSON. `origin` is the public
// dashboard origin (e.g. https://getklar.org).
export function buildBrainBriefing({ origin }: { origin: string }): string {
  return `# Klar AI-Brain — Read-Only Briefing (Learnings / RAG)

Du hast **lesenden** Zugriff auf Alains **AI-Brain** — den zentralen Wissensspeicher
(Learnings, Projekt-Status, Patterns). Du lädst den kompletten Brain-Kontext über
**einen** Endpoint. **Kein Vault, keine API-Keys, kein Schreibzugriff.**

## Endpoint & Auth
- **Alles als Markdown (ein Dokument):** \`GET ${origin}/api/brain/export?format=md\`
- **Strukturiert (JSON \`{ repo, ref, count, notes:[{path,content}] }\`):** \`GET ${origin}/api/brain/export\`
- **Header:** \`Authorization: Bearer <KLAR_BRAIN_TOKEN>\` (Scope \`brain:read\`)
- Der Token steht **nicht** in diesem Prompt. Lies ihn zur Laufzeit aus der
  Umgebungsvariable \`KLAR_BRAIN_TOKEN\` oder einer Secrets-Datei. **Gib ihn nie im Chat/Log/Commit aus.**
- Token noch nicht hinterlegt? Alain mintet einen unter \`${origin}/admin\` →
  **AI-Brain → Zugang → „Token erzeugen"** (Scope \`brain:read\`) und gibt ihn dir,
  ohne ihn in einen Chat zu pasten.

## Was du bekommst
- Alle \`.md\`-Notes des Brains: \`Learnings/\` (inkl. \`Learnings/INDEX.md\`),
  \`Projects/*/PROGRESS.md\`, \`STATUS.md\`, Templates, Patterns …
- **Nie enthalten:** \`Secrets/\` und \`Credentials/\` — serverseitig herausgefiltert.

## Aufruf (curl)
\`\`\`bash
# Ganzes Brain als ein Markdown-Doc laden:
curl -s "${origin}/api/brain/export?format=md" \\
  -H "Authorization: Bearer $KLAR_BRAIN_TOKEN"

# Oder strukturiert als JSON:
curl -s ${origin}/api/brain/export \\
  -H "Authorization: Bearer $KLAR_BRAIN_TOKEN"
\`\`\`

## Nutzung
- Lade den Export als Kontext, dann beantworte Fragen / wende die Learnings an.
- Für ein Thema gezielt: im Export nach Tag/Titel grep-en — Startpunkt ist
  \`Learnings/INDEX.md\` (Tabellen „Nach Datum" + „Nach Tag").

## Regeln
- **Read-only.** Kein Schreibzugriff, kein Vault, keine Secrets — nur Lesen der Notes.
- **Rate-Limit:** 30 Exporte / Stunde / IP (jeder Pull zieht das ganze Repo).
- **Fehlercodes:** \`401\` Token fehlt/ungültig/kein \`brain:read\` · \`429\` Rate-Limit ·
  \`502\` GitHub-Fetch fehlgeschlagen · \`503\` nicht konfiguriert.
- Token nie in Chat, Git, Logs oder \`echo\`. Bei Leak: Dashboard → Token
  **widerrufen + neu erzeugen**.
`;
}
