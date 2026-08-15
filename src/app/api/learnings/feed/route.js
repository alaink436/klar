import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// The sync endpoint. A subscriber's agent calls this with their token and gets
// back the learnings written since a date, in the vault's own format, ready to
// append into their category files.
//
//   GET /api/learnings/feed?since=2026-08-01
//   Authorization: Bearer kos_...
//
// Deliberately pull, not push: no mailing list to leak, no attachment to open,
// and the subscriber's agent decides when to merge. The token grants exactly
// this feed and nothing else.
//
// The corpus used to be four markdown files in the repo. It cannot be that any
// more: getklar.org is served from a PUBLIC GitHub repo, and the corpus is the
// thing people pay $49 for. It now lives in a private Supabase storage bucket
// that only the service role can read, which also means a new learning ships
// by uploading a file instead of by redeploying the site.
const BUCKET = "corpus";
const FILES = ["tech-stack.md", "tooling.md", "workflow.md", "cost-discipline.md"];

// One instance serves many requests; half a megabyte of markdown does not need
// re-downloading for each one. Short TTL so an uploaded corpus goes live on
// its own without a deploy.
const TTL_MS = 5 * 60 * 1000;
let cache = { at: 0, entries: null };

function bearer(req) {
  const h = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : "";
}

// Entries carry their date in the heading: "## [2026-08-14] ..." or
// "## 2026-08-14: ...". Both spellings exist in the corpus, so both are read.
function parseEntries(text, file) {
  return text
    .split(/\n(?=## )/)
    .filter((b) => b.startsWith("## "))
    .map((body) => {
      const head = body.split("\n")[0];
      const date = (head.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
      const tags = [...(body.match(/`[^`]+`/g) || [])]
        .slice(0, 8)
        .map((t) => t.replace(/`/g, ""));
      return { file, date, title: head.replace(/^##\s*/, ""), tags, body };
    })
    .filter((e) => e.date);
}

async function loadCorpus(supabase) {
  if (cache.entries && Date.now() - cache.at < TTL_MS) return cache.entries;

  const entries = [];
  for (const f of FILES) {
    const { data, error } = await supabase.storage.from(BUCKET).download(f);
    // One missing file must not quietly halve what a subscriber paid for, so
    // a failed download is an error rather than a shorter feed.
    if (error || !data) return null;
    entries.push(...parseEntries(await data.text(), f));
  }
  entries.sort((a, b) => b.date.localeCompare(a.date));

  cache = { at: Date.now(), entries };
  return entries;
}

export async function GET(req) {
  const token = bearer(req);
  if (!token) {
    return NextResponse.json({ error: "missing token" }, { status: 401 });
  }

  const url = (process.env.KLAROS_SUPABASE_URL || "").trim();
  const serviceKey = (process.env.KLAROS_SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const supabase = createClient(url, serviceKey);
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, plan")
    .eq("token", token)
    .maybeSingle();

  // One message for "no such token" and for "lapsed", so the endpoint cannot
  // be used to find out which tokens exist.
  if (!sub || sub.status !== "active") {
    return NextResponse.json({ error: "no active subscription for this token" }, { status: 403 });
  }

  const entries = await loadCorpus(supabase);
  if (!entries) {
    return NextResponse.json({ error: "corpus unavailable" }, { status: 503 });
  }

  const since = (new URL(req.url).searchParams.get("since") || "").trim();
  const cutoff = /^\d{4}-\d{2}-\d{2}$/.test(since) ? since : null;
  const fresh = cutoff ? entries.filter((e) => e.date > cutoff) : entries;

  return NextResponse.json(
    {
      generated: new Date().toISOString().slice(0, 10),
      since: cutoff,
      total_in_corpus: entries.length,
      returned: fresh.length,
      // The vault rule the subscriber's agent has to follow when merging:
      // category file first, index second. Stated in the payload so the agent
      // reads it at the moment it matters.
      merge_rule:
        "Write each entry into Learnings/<file> first, then link its title in Learnings/INDEX.md. Never index-first.",
      entries: fresh,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
