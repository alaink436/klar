"use server";

// Server actions hinter dem Posting-Board. Wie überall im Admin gilt: der
// Auth-Gate der Seite reicht für die Anzeige, aber eine Server-Action ist eine
// eigene, direkt aufrufbare URL — sie prüft ihre Berechtigung selbst.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { verifyDeviceCookie } from "@/lib/deviceCookie";
import {
  deleteAccountStatus,
  listAccountStatus,
  saveAccountStatus,
  setPostDone,
} from "@/lib/accountStatus";
import {
  listDirectionHistory,
  patchCurrent,
  reorient,
  type AccountDirection,
  type DirectionPatch,
} from "@/lib/accountDirection";
import {
  listChannelReferenceHistory,
  removeChannelVideo,
  saveChannelReference,
  signierteZiele,
  wechsleDateien,
  type ChannelReferencePatch,
} from "@/lib/channelReference";
import {
  archivePostSample,
  createPostSample,
  savePostSample,
  setPostFiles,
  type PostSamplePatch,
} from "@/lib/postSample";
import type { AccountStatusPatch, Direction } from "@/lib/accountStates";

async function requireAdmin(): Promise<boolean> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  if (!KEY || !DEV) return false;
  const jar = await cookies();
  if (jar.get("klar_admin")?.value !== KEY) return false;
  return Boolean(await verifyDeviceCookie(jar.get("klar_device")?.value ?? "", DEV));
}

export async function updateAccount(key: string, patch: AccountStatusPatch): Promise<void> {
  if (!(await requireAdmin())) return;
  await saveAccountStatus(key, patch);
  revalidatePath("/admin/todos");
}

export async function markPosted(
  key: string,
  day: string,
  slot: number,
  done: boolean,
  note?: string | null,
): Promise<void> {
  if (!(await requireAdmin())) return;
  await setPostDone(key, day, slot, done, note);
  revalidatePath("/admin/todos");
}

/**
 * Neu orientieren: die laufende Richtung schliessen, eine neue anlegen.
 *
 * Der Grund gehört an die alte Zeile — er beantwortet, warum aufgehört wurde.
 * Ohne Grund geht es auch; ein erzwungenes Textfeld führt nur zu „weiss nicht".
 */
export async function reorientAccount(
  key: string,
  richtung: Direction,
  opts: { referenz?: string | null; spiegelt?: string | null; grund?: string | null } = {},
): Promise<void> {
  if (!(await requireAdmin())) return;
  await reorient(key, richtung, opts);
  revalidatePath("/admin/todos");
}

/**
 * Referenz oder Spiegelung der laufenden Richtung ändern. Kein Wechsel: eine
 * falsch getippte Referenz zu korrigieren ist keine Neuorientierung und darf
 * keine Zeile im Verlauf erzeugen.
 */
export async function setDirectionPointer(key: string, patch: DirectionPatch): Promise<void> {
  if (!(await requireAdmin())) return;
  await patchCurrent(key, patch);
  revalidatePath("/admin/todos");
}

export interface Zeitleiste {
  art: "richtung" | "referenz";
  /** Was gesetzt wurde: die Richtung, oder der Titel des Videos. */
  was: string;
  /** Bei einer Referenz: die Ebene, an der sie hing. */
  ebene?: string;
  ab: string;
  bis: string | null;
  grund: string | null;
}

/**
 * Richtungswechsel und Referenzwechsel eines Kanals in EINER Liste, neueste
 * zuerst.
 *
 * Getrennt zu zeigen hiesse, den Zusammenhang wegzuwerfen: eine neue Richtung
 * und ein neues Referenzvideo sind fast immer derselbe Entschluss, ein paar
 * Sekunden auseinander. Nebeneinander liest man das, untereinander nicht.
 *
 * Die Referenzen kommen aus allen drei Ebenen des Kanals: hat das Video an
 * seiner App gewechselt, ist der Kanal genauso betroffen.
 */
export async function loadChannelTimeline(key: string): Promise<Zeitleiste[]> {
  if (!(await requireAdmin())) return [];
  const [richtungen, referenzen] = await Promise.all([
    listDirectionHistory(key),
    listChannelReferenceHistory(key),
  ]);
  const alles: Zeitleiste[] = [
    ...richtungen.map((r) => ({
      art: "richtung" as const,
      was: r.richtung,
      ab: r.ab,
      bis: r.bis,
      grund: r.grund,
    })),
    ...referenzen.map((r) => ({
      art: "referenz" as const,
      was:
        r.titel ||
        (r.dateien?.length
          ? `${r.dateien.length} Datei(en)`
          : r.video_link || "Referenz"),
      ebene: r.scope,
      ab: String(r.ab).slice(0, 10),
      bis: r.bis ? String(r.bis).slice(0, 10) : null,
      grund: r.grund,
    })),
  ];
  // Neueste zuerst; bei gleichem Datum die laufende oben, sie ist die Antwort
  // auf „was gilt jetzt".
  alles.sort((a, b) => (a.ab === b.ab ? (a.bis ? 1 : 0) - (b.bis ? 1 : 0) : a.ab < b.ab ? 1 : -1));
  return alles;
}

/**
 * Der Verlauf eines Kanals, für das Aufklappen im Board.
 *
 * Wird erst auf Klick geholt statt mit der Seite mitzuladen: das Board zeigt
 * normalerweise nur die Zahl, und 24 Verläufe bei jedem Seitenaufruf wären
 * Ladezeit für etwas, das fast nie jemand aufmacht.
 */
export async function loadDirectionHistory(key: string): Promise<AccountDirection[]> {
  if (!(await requireAdmin())) return [];
  return listDirectionHistory(key);
}

/**
 * Titel, Notiz oder Link an einer Ebene ändern (App, Plattform, Kanal).
 *
 * Die Dateien selbst gehen nicht hierüber, sondern per `uploadVorbereiten`
 * direkt vom Browser in den Bucket — an Vercels 4,5-MB-Body vorbei.
 */
export async function setChannelReference(
  scope: string,
  patch: ChannelReferencePatch,
): Promise<{ ok: boolean; fehler?: string }> {
  if (!(await requireAdmin())) return { ok: false, fehler: "nicht angemeldet" };
  const res = await saveChannelReference(scope, patch);
  if (res.ok) revalidatePath("/admin/todos");
  return res;
}

/**
 * Ein Feld an einem gelaufenen Post ändern — meist die Notiz, also Alains
 * Anweisung, worauf sich künftige Posts beziehen sollen.
 */
export async function setPostSample(id: number, patch: PostSamplePatch): Promise<{ ok: boolean }> {
  if (!(await requireAdmin())) return { ok: false };
  const res = await savePostSample(id, patch);
  if (res.ok) revalidatePath("/admin/todos");
  return res;
}

/**
 * Einen Post aus der Sammlung nehmen. Er wird stillgelegt, nicht gelöscht: was
 * einmal lief, bleibt ein Beleg, auch wenn es nicht mehr das Vorbild sein soll.
 */
export async function dropPostSample(id: number): Promise<{ ok: boolean }> {
  if (!(await requireAdmin())) return { ok: false };
  const res = await archivePostSample(id);
  if (res.ok) revalidatePath("/admin/todos");
  return res;
}

/**
 * Ziele für einen Upload besorgen, in die der Browser direkt schreibt.
 *
 * Die Datei geht nicht über unseren Server: eine Vercel-Funktion nimmt nur
 * 4,5 MB Body an, und die Oberfläche verspricht 200 MB. Was der Browser
 * bekommt, ist ein Einmal-Token je Pfad; der Service-Key bleibt hier.
 */
export async function uploadVorbereiten(
  scope: string,
  namen: string[],
  art: "referenz" | "post",
): Promise<{ ok: boolean; ziele?: { pfad: string; url: string }[]; fehler?: string }> {
  if (!(await requireAdmin())) return { ok: false, fehler: "nicht angemeldet" };
  if (!namen.length) return { ok: false, fehler: "keine Datei" };
  const tag = new Date().toISOString().slice(0, 10);
  // Der Ordner trägt Ebene und Tag, damit eine zweite Runde die erste nicht
  // überschreibt — der Verlauf zeigt sonst auf Dateien, die es nicht mehr gibt.
  const ordner =
    art === "post"
      ? `posts/${scope.replace(/:/g, "_")}/${tag}-${Date.now()}`
      : `kanal/${scope.replace(/:/g, "_")}/${tag}-${Date.now()}`;
  const ziele = await signierteZiele(ordner, namen);
  if (ziele.length !== namen.length) return { ok: false, fehler: "Ziele nicht erhalten" };
  return { ok: true, ziele };
}

/**
 * Die fertig hochgeladenen Pfade an der Ebene bzw. am Post festhalten.
 *
 * Erst hier entsteht die Zeile. Wäre es andersherum, stünde nach einem
 * abgebrochenen Upload ein Eintrag da, der auf nichts zeigt.
 */
export async function dateienUebernehmen(
  scope: string,
  pfade: string[],
  art: "referenz" | "post",
  extra: { notiz?: string; ergebnis?: string; grund?: string } = {},
): Promise<{ ok: boolean; fehler?: string }> {
  if (!(await requireAdmin())) return { ok: false, fehler: "nicht angemeldet" };
  if (art === "post") {
    const angelegt = await createPostSample(scope, {
      notiz: extra.notiz ?? null,
      ergebnis: extra.ergebnis ?? null,
    });
    if (!angelegt.ok || !angelegt.id) return { ok: false, fehler: angelegt.fehler };
    const res = await setPostFiles(angelegt.id, pfade);
    revalidatePath("/admin/todos");
    return res.ok ? { ok: true } : { ok: false, fehler: "Pfade nicht gespeichert" };
  }
  const res = await wechsleDateien(scope, pfade, extra.grund ?? null);
  if (res.ok) revalidatePath("/admin/todos");
  return res;
}

/** Die Dateien einer Ebene wegnehmen. Die Zeile wird geschlossen, nicht gelöscht. */
export async function referenzEntfernen(scope: string): Promise<{ ok: boolean }> {
  if (!(await requireAdmin())) return { ok: false };
  const res = await removeChannelVideo(scope);
  if (res.ok) revalidatePath("/admin/todos");
  return res;
}

/**
 * Ein Account, den lib/socialAccounts nicht kennt. Der Schlüssel wird aus
 * App/Plattform/Handle gebaut — dieselbe Form wie `accountKey()`, damit eine
 * spätere Aufnahme in den Code dieselbe Zeile trifft statt eine zweite anzulegen.
 */
export async function addAccount(app: string, platform: string, handle: string): Promise<void> {
  if (!(await requireAdmin())) return;
  const a = app.trim().toLowerCase().slice(0, 60);
  const p = platform.trim().toLowerCase().slice(0, 40);
  const h = handle.trim().replace(/^@/, "").slice(0, 80);
  if (!a || !p || !h) return;
  await saveAccountStatus(`${a}:${p}:${h}`, { app: a, platform: p, handle: h, state: "warmup" });
  revalidatePath("/admin/todos");
}

/**
 * Zwei Kanäle demselben Konto zuschlagen.
 *
 * Der Aufrufer nennt nur EINEN Partner; welchen Namen das Konto danach trägt
 * und wer sonst noch umgeschrieben werden muss, entscheidet der Server. Sonst
 * müsste man denselben Namen auf beiden Zeilen von Hand tippen, und ein Tippfehler
 * ergäbe zwei Konten, die aussehen wie eines.
 *
 * Die Regeln, in dieser Reihenfolge:
 *   - hat einer der beiden schon ein Konto, gilt dessen Name;
 *   - haben BEIDE eines, gewinnt das des Ziels, und das andere wird
 *     hineingezogen (mitsamt allen seinen Mitgliedern — sonst bliebe die Hälfte
 *     einer Gruppe zurück);
 *   - hat keiner eines, heisst das Konto wie das Handle des Ziels.
 */
export async function linkChannels(sourceKey: string, targetKey: string): Promise<void> {
  if (!(await requireAdmin())) return;
  if (!sourceKey.trim() || !targetKey.trim() || sourceKey === targetKey) return;

  const status = await listAccountStatus();
  const groupOf = (key: string) => status.get(key)?.content_group?.trim() || "";
  const targetGroup = groupOf(targetKey);
  const sourceGroup = groupOf(sourceKey);

  // Der Name fällt auf das Handle zurück, weil ein Konto etwas ist, das man
  // wiedererkennen muss — „girlysgirl78" sagt mehr als eine erzeugte Kennung.
  const name =
    targetGroup ||
    sourceGroup ||
    (status.get(targetKey)?.handle || targetKey.split(":").pop() || "konto").slice(0, 60);

  const keys = new Set([sourceKey, targetKey]);
  for (const [key, row] of status) {
    const g = row.content_group?.trim();
    if (g && (g === targetGroup || g === sourceGroup)) keys.add(key);
  }

  for (const key of keys) {
    if (groupOf(key) === name) continue; // steht schon richtig
    await saveAccountStatus(key, { contentGroup: name });
  }
  revalidatePath("/admin/todos");
}

/**
 * Einen Kanal aus seinem Konto lösen. Bleibt danach genau einer übrig, wird
 * auch der gelöst: ein Konto mit einem einzigen Kanal behauptet eine Verbindung,
 * die es nicht gibt.
 */
export async function unlinkChannel(key: string): Promise<void> {
  if (!(await requireAdmin())) return;
  const status = await listAccountStatus();
  const group = status.get(key)?.content_group?.trim() || "";
  await saveAccountStatus(key, { contentGroup: null });
  if (group) {
    const rest = [...status.entries()].filter(
      ([k, row]) => k !== key && row.content_group?.trim() === group,
    );
    if (rest.length === 1) await saveAccountStatus(rest[0][0], { contentGroup: null });
  }
  revalidatePath("/admin/todos");
}

/** Entfernt nur selbst angelegte Zeilen — Code-Accounts kommen beim Laden zurück. */
export async function removeAccount(key: string): Promise<void> {
  if (!(await requireAdmin())) return;
  await deleteAccountStatus(key);
  revalidatePath("/admin/todos");
}
