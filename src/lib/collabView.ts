// SERVER ONLY. Turns the raw collab threads into the rows the Collabs page
// renders. Lives here rather than inside the page because the sidebar also
// needs the "unanswered" count for its badge, and both must agree on what
// counts as unanswered (= the last message in the thread came in).

import { fmtRelative } from "@/app/admin/_shared";
import {
  COLLAB_ALIASES,
  COLLAB_CHANNEL_LABELS,
  COLLAB_STAGE_LABELS,
  collabAddressFor,
  collabAppOptions,
  collabThreadKey,
  listCollabStages,
  listCollabThreads,
  type CollabStageRow,
  type CollabThread,
} from "@/lib/collabStore";
import type { CollabAliasRow, CollabAppOption, CollabThreadRow } from "@/app/admin/collabs/CollabsView";

export interface CollabView {
  aliases: CollabAliasRow[];
  threads: CollabThreadRow[];
  /** Apps für das Kanal-/App-Dropdown im manuellen Erfassungsformular. */
  apps: CollabAppOption[];
  /** Threads whose last message came in — the number on the sidebar badge. */
  open: number;
}

function toRows(
  threads: CollabThread[],
  stages: Map<string, CollabStageRow>,
): CollabThreadRow[] {
  // App-Slug → Anzeigename (aus der Alias-Map; deckt auch AnimeVault + Studio
  // ab). Threads tragen den ggf. per Text-Erkennung zugeordneten App-Slug.
  const appNames: Record<string, string> = {};
  for (const meta of Object.values(COLLAB_ALIASES)) appNames[meta.app] = meta.name;

  return threads.map((t) => {
    const last = t.messages[t.messages.length - 1];
    const snippet = (last?.body ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
    const inboundCount = t.messages.filter((m) => m.direction === "in").length;
    // Drei Zustände statt zwei: seit es manuelle Einträge gibt, ist "letzte
    // Nachricht ging raus" nicht mehr gleichbedeutend mit "erledigt" — ein
    // selbst angeschriebener Influencer, der nie geantwortet hat, wäre sonst
    // als "beantwortet" durchgerutscht.
    const status: CollabThreadRow["status"] =
      last?.direction === "in" ? "open" : inboundCount === 0 ? "waiting" : "answered";
    // Der von Hand gepflegte Stand. Fehlt die Zeile, bleibt es bei null —
    // "noch nie hingeschaut" ist eine eigene Aussage und wird nicht zu
    // "Kontakt" geschönt (siehe Migration 0026).
    const stage = stages.get(collabThreadKey(t.app, t.contactEmail)) ?? null;
    return {
      app: t.app,
      contactEmail: t.contactEmail,
      contactName: t.contactName,
      contactHandle: t.contactHandle,
      channel: t.channel,
      channelLabel: COLLAB_CHANNEL_LABELS[t.channel] ?? t.channel,
      manualOnly: t.manualOnly,
      appName: appNames[t.app] ?? t.app,
      address: t.address,
      lastSubject: last?.subject ?? null,
      lastSnippet: snippet,
      inboundCount,
      unanswered: last?.direction === "in",
      status,
      stage: stage?.stage ?? null,
      stageLabel: stage ? COLLAB_STAGE_LABELS[stage.stage] : null,
      stageNote: stage?.note ?? "",
      stageSince: stage?.updated_at ? fmtRelative(stage.updated_at) : null,
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
  // Zwei unabhängige Tabellen, parallel geholt — der Stand hängt nicht an den
  // Nachrichten, und ein Thread ohne Stand ist genauso gültig wie umgekehrt.
  const [rawThreads, stages] = await Promise.all([listCollabThreads(), listCollabStages()]);
  const threads = toRows(rawThreads, stages);
  return {
    aliases: collabAliasRows(),
    threads,
    apps: collabAppOptions(),
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
