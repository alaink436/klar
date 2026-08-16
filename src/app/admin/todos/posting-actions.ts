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
import type { AccountStatusPatch } from "@/lib/accountStates";

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
