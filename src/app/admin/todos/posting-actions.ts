"use server";

// Server actions hinter dem Posting-Board. Wie überall im Admin gilt: der
// Auth-Gate der Seite reicht für die Anzeige, aber eine Server-Action ist eine
// eigene, direkt aufrufbare URL — sie prüft ihre Berechtigung selbst.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { verifyDeviceCookie } from "@/lib/deviceCookie";
import { deleteAccountStatus, saveAccountStatus, setPostDone } from "@/lib/accountStatus";
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
  done: boolean,
  note?: string | null,
): Promise<void> {
  if (!(await requireAdmin())) return;
  await setPostDone(key, day, done, note);
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

/** Entfernt nur selbst angelegte Zeilen — Code-Accounts kommen beim Laden zurück. */
export async function removeAccount(key: string): Promise<void> {
  if (!(await requireAdmin())) return;
  await deleteAccountStatus(key);
  revalidatePath("/admin/todos");
}
