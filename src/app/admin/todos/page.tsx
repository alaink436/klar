// Klar Control · To-do — die freie Liste neben der abgeleiteten Arbeitsliste.
//
// Server component, 2FA-gated wie der Rest von /admin. Die Übersicht zeigt,
// was aus Daten folgt (offene Anfragen, fällige Auszahlungen); hier steht,
// was nur im Kopf ist. Der Zähler offener Punkte taucht als Zeile auf der
// Übersicht auf, damit die Liste nicht in Vergessenheit gerät.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ICON, readCookieFromString } from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { listTodos, todosConfigured } from "@/lib/todoStore";
import { DATE_LOCALE, LANG_COOKIE, normalizeAdminLang, tAdmin } from "../_i18n";
import TodoList, { type TodoRow } from "./TodoList";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function TodosPage() {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) redirect("/admin/login");
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const device = await verifyDeviceCookie(readCookieFromString(cookieHeader, "klar_device"), DEV);
  if (!device) redirect("/admin/login");
  if (readCookieFromString(cookieHeader, "klar_admin") !== KEY) redirect("/admin/login");

  const lang = normalizeAdminLang(readCookieFromString(cookieHeader, LANG_COOKIE));
  const t = tAdmin(lang);
  const todos = await listTodos();
  const rows: TodoRow[] = todos.map((td) => ({
    id: td.id,
    title: td.title,
    done: td.done,
    doneFmt: td.done_at
      ? new Date(td.done_at).toLocaleDateString(DATE_LOCALE[lang], { day: "2-digit", month: "2-digit" })
      : null,
  }));

  const topbar = `
    <span class="crumb"><b>${t.navTodos}</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="${t.themeToggle}" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>To-do · Klar Control</title>
      <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
      <div className="content">
        <h1>{t.navTodos}</h1>
        <p className="sub">{t.todoSub}</p>
        {!todosConfigured() ? (
          <div className="flash" style={{ borderColor: "color-mix(in oklab,var(--warning) 35%,var(--line))", color: "var(--warning)" }}>
            {t.todoNotConfigured}
          </div>
        ) : null}
        <TodoList rows={rows} lang={lang} />
      </div>
    </>
  );
}
