// SERVER ONLY. Turns the raw collab threads into the rows the Collabs page
// renders. Lives here rather than inside the page because the sidebar also
// needs the "unanswered" count for its badge, and both must agree on what
// counts as unanswered (= the last message in the thread came in).

import { fmtRelative } from "@/app/admin/_shared";
import {
  COLLAB_ALIASES,
  collabAddressFor,
  listCollabThreads,
  type CollabThread,
} from "@/lib/collabStore";
import type { CollabAliasRow, CollabThreadRow } from "@/app/admin/collabs/CollabsView";

export interface CollabView {
  aliases: CollabAliasRow[];
  threads: CollabThreadRow[];
  /** Threads whose last message came in — the number on the sidebar badge. */
  open: number;
}

function toRows(threads: CollabThread[]): CollabThreadRow[] {
  // App-Slug → Anzeigename (aus der Alias-Map; deckt auch AnimeVault + Studio
  // ab). Threads tragen den ggf. per Text-Erkennung zugeordneten App-Slug.
  const appNames: Record<string, string> = {};
  for (const meta of Object.values(COLLAB_ALIASES)) appNames[meta.app] = meta.name;

  return threads.map((t) => {
    const last = t.messages[t.messages.length - 1];
    const snippet = (last?.body ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
    return {
      contactEmail: t.contactEmail,
      contactName: t.contactName,
      appName: appNames[t.app] ?? t.app,
      address: t.address,
      lastSubject: last?.subject ?? null,
      lastSnippet: snippet,
      inboundCount: t.messages.filter((m) => m.direction === "in").length,
      unanswered: last?.direction === "in",
      whenRel: t.lastActivityAt ? fmtRelative(t.lastActivityAt) : "—",
      inboxHref: `/admin/inbox?f=collab&sel=${encodeURIComponent(`collab:${t.app}:${t.contactEmail}`)}`,
    };
  });
}

/** One address per app, the studio-wide one (collab@) pinned first. */
export function collabAliasRows(): CollabAliasRow[] {
  const seen = new Set<string>();
  const rows: CollabAliasRow[] = [];
  for (const [alias, meta] of Object.entries(COLLAB_ALIASES)) {
    if (seen.has(meta.app)) continue; // wavelength/thinq etc. → 1 Adresse pro App
    const address = collabAddressFor(alias);
    if (!address) continue; // KLAR_INBOUND_DOMAIN fehlt → keine Adressen anzeigbar
    seen.add(meta.app);
    rows.push({ appName: meta.name, address, general: meta.app === "studio" });
  }
  rows.sort((a, b) => Number(b.general ?? false) - Number(a.general ?? false));
  return rows;
}

export async function buildCollabView(): Promise<CollabView> {
  const threads = toRows(await listCollabThreads());
  return {
    aliases: collabAliasRows(),
    threads,
    open: threads.filter((t) => t.unanswered).length,
  };
}

/**
 * Just the badge number, for the sidebar on every admin page. Cached for a
 * minute: it rides along with every page render, and a mail that shows up one
 * minute late in a counter is not worth a PostgREST round-trip per navigation.
 */
export async function countOpenCollabs(): Promise<number> {
  const threads = await listCollabThreads(400, { revalidateSeconds: 60 });
  return threads.filter((t) => t.messages[t.messages.length - 1]?.direction === "in").length;
}
