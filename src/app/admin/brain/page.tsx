// Klar Control · AI-Brain view.
//
// Server component. Reads the AI-Brain GitHub repo (alaink436/AI-Brain) via the
// GitHub contents API and renders a browsable, read-only view inside the Klar
// Control chrome (same STYLE/ICON + same 2FA gate as the rest of /admin).
// The GitHub token never reaches the client. First React view of the planned
// /admin → React migration (strangler-fig; sits beside the HTML route.ts views).
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
  SMOKE_BG_SCRIPT,
  readCookieFromString,
  adminSidebar,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps } from "../../../lib/adminApps";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REPO = "alaink436/AI-Brain";
const BRANCH = "master";
const TOKEN = process.env.BRAIN_GITHUB_TOKEN ?? "";

type GhEntry = { name: string; path: string; type: "dir" | "file"; size: number };
type LoadResult =
  | { kind: "dir"; entries: GhEntry[] }
  | { kind: "file"; name: string; text: string }
  | { kind: "error"; status: number; message: string };

async function ghContents(path: string): Promise<LoadResult> {
  const url = `https://api.github.com/repos/${REPO}/contents/${encodeURI(path)}?ref=${BRANCH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!res.ok) return { kind: "error", status: res.status, message: res.statusText };
  const data = await res.json();
  if (Array.isArray(data)) {
    const entries = (data as GhEntry[])
      .filter((e) => e.type === "dir" || e.name.toLowerCase().endsWith(".md"))
      .sort((a, b) =>
        a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1
      );
    return { kind: "dir", entries };
  }
  const b64 = (data.content ?? "").replace(/\n/g, "");
  const text = b64 ? Buffer.from(b64, "base64").toString("utf-8") : "";
  return { kind: "file", name: data.name as string, text };
}

const FolderIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);
const DocIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3h6l5 5v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v5h5" />
  </svg>
);
const UpIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 16px",
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  color: "var(--fg)",
  fontSize: 14,
  textDecoration: "none",
};

function BrowseRow({
  href,
  icon,
  name,
  dim,
  bold,
}: {
  href: string;
  icon: React.ReactNode;
  name: string;
  dim?: boolean;
  bold?: boolean;
}) {
  return (
    <a href={href} style={rowStyle}>
      <span style={{ display: "inline-flex", color: "var(--fg-3)" }}>{icon}</span>
      <span style={{ fontWeight: bold ? 600 : 400, color: dim ? "var(--fg-3)" : "var(--fg)" }}>
        {name}
      </span>
    </a>
  );
}

export default async function BrainPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
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
  const cleanPath = (sp.path ?? "").replace(/^\/+|\/+$/g, "");
  const segs = cleanPath ? cleanPath.split("/") : [];

  const result: LoadResult | null = TOKEN ? await ghContents(cleanPath) : null;

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
      <canvas id="klar-smoke-bg" aria-hidden="true" suppressHydrationWarning />
      <div className="klar-aurora" aria-hidden="true" />
      <div dangerouslySetInnerHTML={{ __html: GLASS_SVG_DEFS }} />
      <div className="layout">
        <aside className="side" dangerouslySetInnerHTML={{ __html: sidebar }} />
        <main className="main">
          <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
          <div className="content">
            <h1>AI-Brain</h1>
            <p className="sub">
              Dein Wissensspeicher, live aus GitHub gelesen. Ordner öffnen, Notizen lesen.
            </p>

            {/* Breadcrumbs */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                alignItems: "center",
                marginBottom: 18,
                fontFamily: "var(--font-mono)",
                fontSize: 13,
              }}
            >
              <a className="applink" href="/admin/brain">
                AI-Brain
              </a>
              {segs.map((seg, i) => {
                const sub = segs.slice(0, i + 1).join("/");
                return (
                  <span key={sub} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <span style={{ color: "var(--fg-4)" }}>/</span>
                    <a className="applink" href={`/admin/brain?path=${encodeURIComponent(sub)}`}>
                      {seg}
                    </a>
                  </span>
                );
              })}
            </div>

            {/* Body */}
            {!TOKEN || result === null ? (
              <div className="card">
                <div className="k">Setup nötig</div>
                <p className="s">
                  Setze <code>BRAIN_GITHUB_TOKEN</code> (Fine-grained PAT, Repo <b>{REPO}</b>,
                  Contents: Read) in den Vercel-Env-Vars des klar-Projekts, dann Redeploy.
                </p>
              </div>
            ) : result.kind === "error" ? (
              <div className="card">
                <div className="k">Fehler {result.status}</div>
                <p className="s">
                  {result.status === 404
                    ? "Dieser Pfad existiert nicht im Repo."
                    : result.status === 401
                    ? "Token abgelehnt — BRAIN_GITHUB_TOKEN prüfen."
                    : `${result.message} (${result.status})`}
                </p>
              </div>
            ) : result.kind === "file" ? (
              <div className="card">
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    lineHeight: 1.65,
                    color: "var(--fg-2)",
                  }}
                >
                  {result.text}
                </pre>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cleanPath && (
                  <BrowseRow
                    href={
                      segs.length > 1
                        ? `/admin/brain?path=${encodeURIComponent(segs.slice(0, -1).join("/"))}`
                        : "/admin/brain"
                    }
                    icon={UpIcon}
                    name=".."
                    dim
                  />
                )}
                {result.entries.length === 0 && (
                  <p className="s muted">Leer — keine Ordner oder .md-Notizen.</p>
                )}
                {result.entries.map((e) => (
                  <BrowseRow
                    key={e.path}
                    href={`/admin/brain?path=${encodeURIComponent(e.path)}`}
                    icon={e.type === "dir" ? FolderIcon : DocIcon}
                    name={e.name}
                    bold={e.type === "dir"}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SMOKE_BG_SCRIPT }} />
    </>
  );
}
