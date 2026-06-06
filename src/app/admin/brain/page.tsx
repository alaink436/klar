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
import { redirect } from "next/navigation";
import {
  STYLE,
  ICON,
  FONTS_LINK,
  THEME_INIT_SCRIPT,
  THEME_TOGGLE_SCRIPT,
  GLASS_SVG_DEFS,
  readCookieFromString,
  adminSidebar,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps } from "../../../lib/adminApps";
import { scopeGraph, hasToken, availableFolders, SHOWCASE_FOLDERS } from "@/lib/brainVault";
import { listTokens } from "@/lib/apiTokens";
import { listBrainMembers } from "@/lib/brainMembers";
import BrainExplorer from "@/app/components/brain/BrainExplorer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BrainAccessManager, {
  type TokenRow,
  type MemberRow,
  type FolderOpt,
} from "./BrainAccessManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BrainPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; tab?: string }>;
}) {
  // Auth — identical gate to analytics/page.tsx (device cookie + admin session).
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

  // Full graph (all non-secret folders) baked at build time.
  const graph = scopeGraph(null);
  const tokenReady = hasToken();

  // Zugang-tab data (same sources /admin/settings used before the move).
  const [tokenRows, memberRows] = await Promise.all([listTokens(), listBrainMembers()]);
  const tokens: TokenRow[] = tokenRows.map((t) => ({
    id: t.id,
    label: t.label,
    prefix: t.prefix,
    scopes: t.scopes,
    lastUsed: t.last_used_at ? new Date(t.last_used_at).toLocaleDateString("de-CH") : "—",
    revoked: Boolean(t.revoked_at),
  }));
  const members: MemberRow[] = memberRows.map((m) => ({
    email: m.email,
    clearance: m.clearance,
    folders: m.folders ?? [],
    scope: m.clearance === "full" ? "voller Zugriff" : (m.folders ?? []).join(", "),
    lastSeen: m.last_seen_at ? new Date(m.last_seen_at).toLocaleDateString("de-CH") : "—",
    revoked: Boolean(m.revoked_at),
  }));
  const folders: FolderOpt[] = availableFolders().map((g) => ({
    key: g.key,
    label: g.label,
    color: g.color,
    count: g.count,
    checked: SHOWCASE_FOLDERS.includes(g.key),
  }));

  const defaultTab = sp.tab === "zugang" || sp.msg || sp.err ? "zugang" : "graph";

  const sidebar = adminSidebar("brain", getApps());
  const topbar = `
    <span class="crumb"><b>AI-Brain</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>AI-Brain · Klar Control</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={FONTS_LINK} rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_TOGGLE_SCRIPT }} />
      <div className="klar-aurora" aria-hidden="true" />
      <div dangerouslySetInnerHTML={{ __html: GLASS_SVG_DEFS }} />
      <div className="layout">
        <aside className="side" dangerouslySetInnerHTML={{ __html: sidebar }} />
        <main className="main">
          <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
          <div className="content" style={{ maxWidth: "none" }}>
            <h1>AI-Brain</h1>
            <p className="sub">
              Dein Wissensspeicher als Graph plus die Zugänge dazu — API-Tokens für Remote-Agents und Lese-Mitglieder
              für /brain.
            </p>

            {sp.err && (
              <div className="flash" style={{ borderColor: "color-mix(in oklab,var(--danger) 35%,var(--line))", color: "var(--danger)" }}>
                {sp.err}
              </div>
            )}
            {sp.msg && <div className="flash">{sp.msg}</div>}

            <Tabs defaultValue={defaultTab}>
              <TabsList>
                <TabsTrigger value="graph">Graph</TabsTrigger>
                <TabsTrigger value="zugang">Zugang</TabsTrigger>
              </TabsList>

              <TabsContent value="graph">
                {!tokenReady && (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div className="k">Notiz-Inhalte deaktiviert</div>
                    <p className="s">
                      Der Graph wird angezeigt, aber zum Öffnen von Notizen fehlt <code>BRAIN_GITHUB_TOKEN</code>{" "}
                      (Fine-grained PAT, Contents: Read) in den Vercel-Env-Vars. Nach dem Setzen neu deployen.
                    </p>
                  </div>
                )}
                <div style={{ height: "calc(100dvh - 280px)", minHeight: 480 }}>
                  <BrainExplorer graph={graph} noteApi="/admin/brain/note" />
                </div>
              </TabsContent>

              <TabsContent value="zugang">
                <BrainAccessManager tokens={tokens} members={members} folders={folders} />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </>
  );
}
