// AI-Brain viewer: browse + read the Markdown knowledge base straight from the
// private GitHub repo (alaink436/AI-Brain) via the GitHub contents API. This is
// a server component, so the GitHub token never reaches the client. Read-only
// for now; "propose an edit -> open a PR" lands in a later phase.

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/supabaseAuth";
import { PageHeader, Card } from "../_shared/ui";

export const dynamic = "force-dynamic";

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
  if (!res.ok) {
    return { kind: "error", status: res.status, message: res.statusText };
  }
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

export default async function BrainPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/dashboard/login");

  const { path = "" } = await searchParams;
  const cleanPath = path.replace(/^\/+|\/+$/g, "");
  const segs = cleanPath ? cleanPath.split("/") : [];

  if (!TOKEN) {
    return (
      <>
        <BrainHeader />
        <Card eyebrow="Setup required" title="Connect a GitHub token">
          <p style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.6, margin: 0 }}>
            Set{" "}
            <code style={{ fontFamily: "var(--font-mono, monospace)" }}>BRAIN_GITHUB_TOKEN</code>{" "}
            to a fine-grained personal access token with <b>read</b> access to{" "}
            <b>{REPO}</b>. On Vercel: Project → Settings → Environment Variables. Locally:{" "}
            <code style={{ fontFamily: "var(--font-mono, monospace)" }}>.env.local</code>.
          </p>
        </Card>
      </>
    );
  }

  const result = await ghContents(cleanPath);

  return (
    <>
      <BrainHeader />

      {/* breadcrumbs */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
          marginBottom: 18,
          fontSize: 13,
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        <Crumb href="/dashboard/brain" label="AI-Brain" active={segs.length === 0} />
        {segs.map((seg, i) => {
          const sub = segs.slice(0, i + 1).join("/");
          return (
            <span key={sub} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span style={{ color: "var(--fg-4)" }}>/</span>
              <Crumb
                href={`/dashboard/brain?path=${encodeURIComponent(sub)}`}
                label={seg}
                active={i === segs.length - 1}
              />
            </span>
          );
        })}
      </div>

      {result.kind === "error" && (
        <Card eyebrow={`Error ${result.status}`} title="Could not load from GitHub">
          <p style={{ fontSize: 14, color: "var(--fg-2)", margin: 0, lineHeight: 1.6 }}>
            {result.status === 404
              ? "That path doesn't exist in the repo."
              : result.status === 401
              ? "The token was rejected — check BRAIN_GITHUB_TOKEN."
              : `${result.message} (${result.status})`}
          </p>
        </Card>
      )}

      {result.kind === "dir" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cleanPath && (
            <BrowseRow
              href={
                segs.length > 1
                  ? `/dashboard/brain?path=${encodeURIComponent(segs.slice(0, -1).join("/"))}`
                  : "/dashboard/brain"
              }
              icon="up"
              name=".."
              kind="up"
            />
          )}
          {result.entries.length === 0 && (
            <p style={{ fontSize: 14, color: "var(--fg-3)" }}>
              Empty here — no sub-folders or .md notes.
            </p>
          )}
          {result.entries.map((e) => (
            <BrowseRow
              key={e.path}
              href={`/dashboard/brain?path=${encodeURIComponent(e.path)}`}
              icon={e.type === "dir" ? "folder" : "doc"}
              name={e.name}
              kind={e.type}
            />
          ))}
        </div>
      )}

      {result.kind === "file" && (
        <Card>
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 13,
              lineHeight: 1.65,
              color: "var(--fg-2)",
            }}
          >
            {result.text}
          </pre>
        </Card>
      )}
    </>
  );
}

function BrainHeader() {
  return (
    <PageHeader
      eyebrow="Brain"
      title={
        <>
          The <i style={{ fontFamily: "var(--font-editorial, serif)" }}>knowledge base.</i>
        </>
      }
      intro="Your AI-Brain, read straight from GitHub. Browse folders and open any note."
    />
  );
}

function Crumb({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        color: active ? "var(--fg)" : "var(--fg-3)",
        fontWeight: active ? 600 : 400,
        textDecoration: "none",
      }}
    >
      {label}
    </Link>
  );
}

function BrowseRow({
  href,
  icon,
  name,
  kind,
}: {
  href: string;
  icon: "folder" | "doc" | "up";
  name: string;
  kind: "dir" | "file" | "up";
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: "color-mix(in oklab, var(--fg), transparent 94%)",
        border: "1px solid color-mix(in oklab, var(--fg), transparent 82%)",
        borderRadius: 10,
        textDecoration: "none",
        color: "var(--fg)",
        fontSize: 14,
      }}
    >
      <span style={{ display: "inline-flex", color: "var(--fg-3)" }}>
        {icon === "folder" ? FOLDER_SVG : icon === "doc" ? DOC_SVG : UP_SVG}
      </span>
      <span
        style={{
          fontWeight: kind === "dir" ? 600 : 400,
          color: kind === "up" ? "var(--fg-3)" : "var(--fg)",
        }}
      >
        {name}
      </span>
    </Link>
  );
}

const FOLDER_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);
const DOC_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3h6l5 5v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v5h5" />
  </svg>
);
const UP_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);
