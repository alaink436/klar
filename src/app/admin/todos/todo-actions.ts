"use server";

// Server actions hinter der To-do-Liste. Der Auth-Gate der Seite reicht für
// die Anzeige, aber eine Server-Action ist eine eigene, direkt aufrufbare
// Endpunkt-URL — sie muss ihre Berechtigung selbst prüfen, sonst könnte sie
// jemand ohne Admin-Session aufrufen. Darum hier derselbe Cookie-Check wie
// auf der Seite (Device-Cookie + Admin-Session).

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { verifyDeviceCookie } from "@/lib/deviceCookie";
import { addTodo, clearDoneTodos, deleteTodo, renameTodo, setTodoDone, setTodoPlan } from "@/lib/todoStore";

async function requireAdmin(): Promise<boolean> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  if (!KEY || !DEV) return false;
  const jar = await cookies();
  if (jar.get("klar_admin")?.value !== KEY) return false;
  return Boolean(await verifyDeviceCookie(jar.get("klar_device")?.value ?? "", DEV));
}

/** Beide Seiten, die To-dos zeigen: die Liste und der Zähler auf der Übersicht. */
function refresh(): void {
  revalidatePath("/admin/todos");
  revalidatePath("/admin/overview");
}

export async function createTodo(title: string): Promise<void> {
  if (!(await requireAdmin())) return;
  await addTodo(title);
  refresh();
}

export async function toggleTodo(id: string, done: boolean): Promise<void> {
  if (!(await requireAdmin())) return;
  await setTodoDone(id, done);
  refresh();
}

export async function editTodo(id: string, title: string): Promise<void> {
  if (!(await requireAdmin())) return;
  await renameTodo(id, title);
  refresh();
}

export async function planTodo(
  id: string,
  due: string | null,
  time?: string | null,
): Promise<void> {
  if (!(await requireAdmin())) return;
  await setTodoPlan(id, due, time);
  refresh();
}

export async function removeTodo(id: string): Promise<void> {
  if (!(await requireAdmin())) return;
  await deleteTodo(id);
  refresh();
}

export async function clearDone(): Promise<void> {
  if (!(await requireAdmin())) return;
  await clearDoneTodos();
  refresh();
}
