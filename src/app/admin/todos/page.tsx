// Klar Control · To-do — die freie Liste neben der abgeleiteten Arbeitsliste.
//
// Server component, 2FA-gated wie der Rest von /admin. Die Übersicht zeigt,
// was aus Daten folgt (offene Anfragen, fällige Auszahlungen); hier steht,
// was nur im Kopf ist. Der Zähler offener Punkte taucht als Zeile auf der
// Übersicht auf, damit die Liste nicht in Vergessenheit gerät.
//
// Tagesgruppen (überfällig / heute / morgen / …) werden HIER berechnet, nicht
// im Client: sonst entscheidet die Zeitzone des Browsers, was „heute" ist, und
// der erste Render weicht vom Server ab.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ICON, readCookieFromString } from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { listTodos, todosConfigured } from "@/lib/todoStore";
import { DATE_LOCALE, LANG_COOKIE, normalizeAdminLang, tAdmin } from "../_i18n";
import TodoList, { type TodoBucket, type TodoRow } from "./TodoList";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** "YYYY-MM-DD" in Schweizer Zeit — der Tag, an dem Alain sitzt. */
function localDay(offsetDays = 0): string {
  const now = new Date();
  const swiss = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Zurich" }));
  swiss.setDate(swiss.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${swiss.getFullYear()}-${p(swiss.getMonth() + 1)}-${p(swiss.getDate())}`;
}

function bucketFor(due: string | null, today: string, tomorrow: string): TodoBucket {
  if (!due) return "none";
  const d = due.slice(0, 10);
  if (d < today) return "overdue";
  if (d === today) return "today";
  if (d === tomorrow) return "tomorrow";
  // Alles, was innerhalb der nächsten sieben Tage liegt, ist "diese Woche".
  const limit = new Date(`${today}T12:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 7);
  return d <= limit.toISOString().slice(0, 10) ? "week" : "later";
}

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
  const today = localDay();
  const tomorrow = localDay(1);

  const todos = await listTodos();
  const rows: TodoRow[] = todos.map((td) => ({
    id: td.id,
    title: td.title,
    done: td.done,
    doneFmt: td.done_at
      ? new Date(td.done_at).toLocaleDateString(DATE_LOCALE[lang], { day: "2-digit", month: "2-digit" })
      : null,
    due: td.due_on ? td.due_on.slice(0, 10) : "",
    dueFmt: td.due_on
      ? new Date(`${td.due_on.slice(0, 10)}T12:00:00Z`).toLocaleDateString(DATE_LOCALE[lang], {
          day: "2-digit",
          month: "2-digit",
        })
      : null,
    bucket: bucketFor(td.due_on, today, tomorrow),
  }));
  const planned = rows.filter((r) => !r.done && r.due).length;

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

        <TodoList rows={rows} lang={lang} today={today} tomorrow={tomorrow} />

        {/* Kalender-Abo: die Anleitung steht dort, wo die Punkte entstehen. */}
        <div className="card" style={{ marginTop: 16, padding: "18px 22px", display: "block" }}>
          <div className="k" style={{ margin: 0 }}>{t.icalTitle}</div>
          <p className="s" style={{ maxWidth: "70ch" }}>
            {t.icalBody(planned)}
          </p>
          <ol className="s" style={{ margin: "10px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
            <li>{t.icalStep1}</li>
            <li>
              {t.icalStep2}{" "}
              <code className="[font-family:var(--font-mono)]">webcal://getklar.org/api/todos/ical?token=DEIN_TOKEN</code>
            </li>
            <li>{t.icalStep3}</li>
          </ol>
        </div>
      </div>
    </>
  );
}
