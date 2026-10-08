// Klar Control · AI-Brain view.
//
// Server component. Same 2FA gate as the rest of /admin (device cookie +
// admin session), then renders two tabs inside the Klar Control chrome:
//   - "Graph"  → the Obsidian-style BrainExplorer (full non-secret graph; note
//     bodies load on demand from /admin/brain/note, which holds the GitHub
//     token and re-checks the secret-folder guard).
//   - "Zugang" → API-token + Brain-member management (moved here from
//     /admin/settings), via the shadcn/ui-based BrainAccessManager.
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET, BRAIN_GITHUB_TOKEN.

import { headers } from "next/headers";
import { requireAdminPage } from "../../../lib/adminGuard";
import { datumInZone, inZone } from "@/lib/zeit";
import { scopeGraph, hasToken, availableFolders, SHOWCASE_FOLDERS } from "@/lib/brainVault";
import { readLearnings, readVaultChecks } from "@/lib/brainReader";
import { listTokens } from "@/lib/apiTokens";
import { listSecrets } from "@/lib/vault";
import { buildAgentBriefing, buildBrainBriefing } from "@/lib/agentBriefing";
import { listBrainMembers } from "@/lib/brainMembers";
import BrainExplorer from "@/app/components/brain/BrainExplorer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { TextureCard, TextureCardHeader, TextureCardTitle } from "@/components/ui/texture-card";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { CircuitBoard } from "lucide-react";
import BrainAccessManager, {
  type TokenRow,
  type MemberRow,
  type FolderOpt,
  type SecretOpt,
} from "./BrainAccessManager";

import { AdminTopbar } from "../AdminTopbar";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function originFromHeaders(h: Headers): string {
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "getklar.org";
  return `${proto}://${host}`;
}

// Kleine Ueberschrift ueber einer Zahl oder einem Diagramm.
const LABEL = "[font-family:var(--font-mono)] text-[10.5px] font-medium uppercase tracking-[0.14em] text-fg-3";

export default async function BrainPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; tab?: string }>;
}) {
  await requireAdminPage();
  const h = await headers();

  const sp = await searchParams;

  // Full graph (all non-secret folders) baked at build time.
  const graph = scopeGraph(null);
  const tokenReady = hasToken();

  // Zugang-tab data (same sources /admin/settings used before the move),
  // plus the learnings count — read live from the vault, not from the graph.
  const [tokenRows, memberRows, secretRows, learnings, checks] = await Promise.all([
    listTokens(),
    listBrainMembers(),
    listSecrets(),
    readLearnings(),
    readVaultChecks(),
  ]);

  // Copyable agent-briefing: a self-contained prompt with the live (proxyable)
  // vault secrets, so an agent on a fresh device can use the gateway without the
  // Supabase MCP or the PowerShell wrapper. No secrets in it (token is an env var).
  const origin = originFromHeaders(h);
  const briefing = buildAgentBriefing({
    origin,
    secrets: secretRows
      .filter((s) => !s.revoked_at && s.base_url)
      .map((s) => ({
        id: s.id,
        label: s.label,
        provider: s.provider,
        baseUrl: s.base_url ?? "",
        authHeader: s.auth_header,
        authScheme: s.auth_scheme,
      })),
  });
  const briefingBrain = buildBrainBriefing({ origin });
  // Auswahl fuer die Klartext-Freigabe. Store-only-Secrets sind hier
  // ausdruecklich dabei: dass ein Key keine base_url hat und darum nicht
  // proxybar ist, ist genau der Grund, warum ein CLI ihn im Klartext braucht.
  const secretOpts: SecretOpt[] = secretRows
    .filter((sec) => !sec.revoked_at)
    .map((sec) => ({ id: sec.id, label: sec.label, provider: sec.provider }));
  const secretLabelById = new Map(secretOpts.map((sec) => [sec.id, sec.label]));

  const tokens: TokenRow[] = tokenRows.map((t) => ({
    id: t.id,
    label: t.label,
    prefix: t.prefix,
    scopes: t.scopes,
    secretIds: t.vault_secret_ids ?? [],
    releaseUntil: t.vault_release_until
      ? inZone(t.vault_release_until, {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "",
    releaseExpired: Boolean(
      t.vault_release_until && Date.parse(t.vault_release_until) <= Date.now(),
    ),
    secretLabels: (t.vault_secret_ids ?? []).map((sid) => secretLabelById.get(sid) ?? sid),
    lastUsed: datumInZone(t.last_used_at),
    revoked: Boolean(t.revoked_at),
  }));
  const members: MemberRow[] = memberRows.map((m) => ({
    email: m.email,
    clearance: m.clearance,
    folders: m.folders ?? [],
    scope: m.clearance === "full" ? "voller Zugriff" : (m.folders ?? []).join(", "),
    lastSeen: datumInZone(m.last_seen_at),
    revoked: Boolean(m.revoked_at),
  }));
  const folders: FolderOpt[] = availableFolders().map((g) => ({
    key: g.key,
    label: g.label,
    color: g.color,
    count: g.count,
    checked: SHOWCASE_FOLDERS.includes(g.key),
  }));

  // The graph is the landing view: opening /admin/brain means wanting to see the
  // brain, not its access list. Zugang opens via ?tab=zugang or the tab itself.
  const defaultTab = sp.tab === "zugang" ? "zugang" : "graph";

  return (
    <>
      <title>AI-Brain · Klar Control</title>
      <AdminTopbar titel="AI-Brain" />
      <div className="content" style={{ maxWidth: "none" }}>
        <PageHeader eyebrow="Klar Control" icon={<CircuitBoard />} title="AI-Brain" />

        {sp.err && <Notice tone="danger">{sp.err}</Notice>}
        {sp.msg && <Notice tone="ok">{sp.msg}</Notice>}

        {/* Zustand. Seit dem 2026-08-20 sind STATUS.md, die Registry-Tabelle,
            Learnings/INDEX.md, der Skill-Bestand und die Supabase-Tabelle
            erzeugt. Jeder Generator schreibt seine offenen Punkte in die Datei,
            die er baut, aber die sah nur, wer ihn selbst laufen liess. Hier
            stehen sie zusammen: eine Liste, kein Bild. Leer heisst sauber. */}
        {(() => {
          const offen = checks.reduce((n, c) => n + c.meldungen.length, 0);
          return (
            <TextureCard className="mb-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-6 pt-5">
                <TextureCardTitle>Zustand</TextureCardTitle>
                <Badge tone={offen ? "warn" : "ok"}>{offen === 0 ? "sauber" : `${offen} offen`}</Badge>
                <div className="flex flex-wrap gap-x-3.5 gap-y-1 sm:ml-auto">
                  {checks.map((c) => (
                    <span
                      key={c.pfad}
                      className={`[font-family:var(--font-mono)] text-[11px] ${c.meldungen.length ? "text-fg-2" : "text-fg-4"}`}
                    >
                      {c.quelle} {c.meldungen.length || "✓"}
                      {c.stand ? <span className="text-fg-4"> · {c.stand}</span> : null}
                    </span>
                  ))}
                </div>
              </div>
              <p className="m-0 max-w-[72ch] px-6 pb-4 pt-2 text-[13px] leading-relaxed text-fg-3">
                {offen === 0
                  ? "Keine offenen Punkte aus den Generatoren."
                  : "Punkte, die die Generatoren nicht selbst auflösen können. Sie kürzen nichts still, sie melden."}
              </p>
              {offen > 0 && (
                <ul className="m-0 list-none p-0">
                  {checks.flatMap((c) =>
                    c.meldungen.map((m, i) => (
                      <li key={`${c.pfad}-${i}`} className="flex items-baseline gap-3 border-t border-line px-6 py-2.5">
                        <span className="min-w-[72px] shrink-0 [font-family:var(--font-mono)] text-[11px] text-fg-4">{c.quelle}</span>
                        <span className="text-[13px] text-fg-2">{m}</span>
                      </li>
                    )),
                  )}
                </ul>
              )}
            </TextureCard>
          );
        })()}

        {/* Wächst das Brain? Der Graph darunter zählt DATEIEN, und alle
            Learnings hängen sich an dieselben fünf an. 60 Erkenntnisse sehen
            dort aus wie 5 Punkte. Darum hier die Einträge, gezählt. */}
        {learnings ? (
          <TextureCard className="mb-8">
            <TextureCardHeader className="items-end gap-x-9 pb-2">
              <div>
                <div className={LABEL}>Learnings gesamt</div>
                <div className="klar-verlauf mt-2 text-[40px] font-medium leading-none tracking-[-0.035em] [font-variant-numeric:tabular-nums]">
                  {learnings.total}
                </div>
              </div>
              <div>
                <div className={LABEL}>Diese Woche</div>
                <div className={`mt-2 text-[22px] font-medium leading-none [font-variant-numeric:tabular-nums] ${learnings.last7 > 0 ? "text-fg" : "text-fg-3"}`}>
                  +{learnings.last7}
                </div>
              </div>
              <div>
                <div className={LABEL}>30 Tage</div>
                <div className="mt-2 text-[22px] font-medium leading-none text-fg-2 [font-variant-numeric:tabular-nums]">
                  +{learnings.last30}
                </div>
              </div>
              <p className="m-0 min-w-[260px] max-w-[56ch] flex-1 text-[13px] leading-relaxed text-fg-3">
                Der Graph unten zeigt <b className="font-medium text-fg-2">Dateien</b>. Learnings werden an fünf Dateien
                angehängt, also bleiben es dort fünf Punkte. Gewachsen ist trotzdem, was hier steht.
              </p>
            </TextureCardHeader>
            {/* Verlauf und Themen. Beides steckte schon in den Daten und wurde
                weggeworfen: die Monatsverteilung beantwortet "wann habe ich
                gelernt", die Tags "woran". Eine Serie, also eine Farbe und keine
                Legende; der Titel benennt sie. Reines SVG/CSS, damit die Karte
                serverseitig rendert und kein Bundle kostet. */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-x-8 gap-y-6 px-6 pb-5 pt-4">
              {learnings.byWeek.length > 1 && (() => {
                const max = Math.max(...learnings.byWeek.map((w) => w.count), 1);
                const kurz = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
                return (
                  <div>
                    <div className={`${LABEL} mb-3`}>Pro Woche</div>
                    <div className="flex h-[76px] items-end gap-[3px]">
                      {learnings.byWeek.map((w) => (
                        <div
                          key={w.week}
                          title={`Woche ab ${kurz(w.week)}: ${w.count} Learning${w.count === 1 ? "" : "s"}`}
                          className="flex h-full flex-1 flex-col justify-end"
                        >
                          <div
                            className={`rounded-t-[3px] ${w.count > 0 ? "bg-[linear-gradient(180deg,#f5f5f5,rgba(255,255,255,0.4))]" : "bg-white/[.08]"}`}
                            style={{ height: `${Math.max((w.count / max) * 100, w.count > 0 ? 4 : 2)}%` }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between [font-family:var(--font-mono)] text-[10px] text-fg-4">
                      <span>{kurz(learnings.byWeek[0]!.week)}</span>
                      <span>höchste Woche: {max}</span>
                      <span>{kurz(learnings.byWeek[learnings.byWeek.length - 1]!.week)}</span>
                    </div>
                  </div>
                );
              })()}

              {learnings.topTags.length > 0 && (() => {
                const max = Math.max(...learnings.topTags.map((t) => t.count), 1);
                return (
                  <div>
                    <div className={`${LABEL} mb-3`}>Häufigste Tags</div>
                    <div className="flex flex-col gap-[7px]">
                      {learnings.topTags.slice(0, 6).map((t) => (
                        <div key={t.tag} className="flex items-center gap-2.5">
                          <span className="w-[116px] shrink-0 truncate [font-family:var(--font-mono)] text-[11px] text-fg-3">
                            {t.tag}
                          </span>
                          <div className="relative h-1.5 flex-1 rounded-full bg-white/[.08]">
                            <div
                              title={`${t.tag}: ${t.count} von ${learnings.total} (${Math.round(t.share * 100)} %)`}
                              className="h-full rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.45),#f5f5f5)]"
                              style={{ width: `${(t.count / max) * 100}%` }}
                            />
                            {/* 15-%-Marke als Referenzlinie statt als zweite
                                Farbe: eine Serie behaelt eine Farbe, und die
                                Grenze bleibt ablesbar, auch wenn wie heute die
                                Mehrheit der Tags darueber liegt. */}
                            <div
                              aria-hidden
                              className="absolute -bottom-[3px] -top-[3px] w-px bg-fg-4"
                              style={{ left: `${Math.min((0.15 * learnings.total) / max, 1) * 100}%` }}
                            />
                          </div>
                          <span className="w-[26px] shrink-0 text-right [font-family:var(--font-mono)] text-[11px] text-fg-4">
                            {t.count}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="m-0 mt-2.5 text-[11.5px] leading-relaxed text-fg-4">
                      Der Strich steht bei 15 % vom Bestand. Was darüber liegt, grenzt beim Suchen
                      nichts mehr ein.
                    </p>
                  </div>
                );
              })()}
            </div>

            <ul className="m-0 list-none p-0">
              {learnings.recent.map((e) => (
                <li key={`${e.date}-${e.title}`} className="flex items-baseline gap-3 border-t border-line px-6 py-2.5">
                  <span className="shrink-0 [font-family:var(--font-mono)] text-[11px] text-fg-4">{e.date}</span>
                  <span className="truncate text-[13px] text-fg-2">{e.title}</span>
                </li>
              ))}
            </ul>
          </TextureCard>
        ) : null}

        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="graph">Graph</TabsTrigger>
            <TabsTrigger value="zugang">Zugang</TabsTrigger>
          </TabsList>

          <TabsContent value="graph">
            {!tokenReady && (
              <Notice tone="warn" className="mb-4">
                <b className="font-medium text-fg">Notiz-Inhalte deaktiviert.</b> Der Graph wird angezeigt, aber zum
                Öffnen von Notizen fehlt <code>BRAIN_GITHUB_TOKEN</code> (Fine-grained PAT, Contents: Read) in den
                Vercel-Env-Vars. Nach dem Setzen neu deployen.
              </Notice>
            )}
            {/* klar-brain: Explorer und Graph im Klar-Look, siehe admin.css. */}
            <div className="klar-brain" style={{ height: "calc(100dvh - 280px)", minHeight: 480 }}>
              <BrainExplorer graph={graph} noteApi="/admin/brain/note" />
            </div>
          </TabsContent>

          <TabsContent value="zugang">
            <BrainAccessManager tokens={tokens} members={members} folders={folders} secrets={secretOpts} briefing={briefing} briefingBrain={briefingBrain} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
