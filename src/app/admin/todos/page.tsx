// Klar Control · To-do — Wochenplaner neben der abgeleiteten Arbeitsliste.
//
// Server component, 2FA-gated wie der Rest von /admin. Die Übersicht zeigt,
// was aus Daten folgt (offene Anfragen, fällige Auszahlungen); hier steht,
// was nur im Kopf ist — und wann es dran ist.
//
// Alle Datums-Entscheidungen fallen HIER, in Europe/Zurich: welcher Tag heute
// ist, welche Woche gezeigt wird, was überfällig ist. Überliesse man das dem
// Client, entschiede dessen Zeitzone — und der erste Render wiche vom Server ab.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ICON, readCookieFromString } from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { listTodos, todosConfigured } from "@/lib/todoStore";
import { DATE_LOCALE, LANG_COOKIE, normalizeAdminLang, tAdmin } from "../_i18n";
import Planner, { type PlannerDay, type PlannerTodo } from "./Planner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ZONE = "Europe/Zurich";

/** Heutiges Datum in Zürcher Ortszeit als "YYYY-MM-DD". */
function todayInZurich(): string {
  // en-CA formatiert als YYYY-MM-DD — genau das Format, das wir brauchen.
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(new Date());
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Montag der Woche, in der `iso` liegt. */
function mondayOf(iso: string): string {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = Sonntag
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

export default async function TodosPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
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
  const sp = await searchParams;

  // Wochenversatz aus der URL, hart begrenzt: der Parameter ist frei tippbar.
  const rawW = Number.parseInt(sp.w ?? "0", 10);
  const weekOffset = Number.isFinite(rawW) ? Math.max(-52, Math.min(52, rawW)) : 0;

  const today = todayInZurich();
  const start = addDays(mondayOf(today), weekOffset * 7);
  const locale = DATE_LOCALE[lang];
  const days: PlannerDay[] = Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(start, i);
    const d = new Date(`${iso}T12:00:00Z`);
    return {
      iso,
      weekday: d.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" }),
      dayLabel: d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", timeZone: "UTC" }),
      isToday: iso === today,
      isWeekend: i >= 5,
    };
  });
  const weekLabel = `${days[0].dayLabel} – ${days[6].dayLabel}`;

  const todos = await listTodos();
  const rows: PlannerTodo[] = todos.map((td) => {
    const due = td.due_on ? td.due_on.slice(0, 10) : "";
    return {
      id: td.id,
      title: td.title,
      done: td.done,
      due,
      time: td.due_time ? td.due_time.slice(0, 5) : "",
      doneFmt: td.done_at
        ? new Date(td.done_at).toLocaleDateString(locale, { day: "2-digit", month: "2-digit" })
        : null,
      overdue: !td.done && due !== "" && due < today,
    };
  });

  const topbar = `
    <span class="crumb"><b>${t.navTodos}</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="${t.themeToggle}" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>To-do · Klar Control</title>
      <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
      <div className="content" style={{ maxWidth: "none" }}>
        <h1>{t.navTodos}</h1>
        <p className="max-w-[70ch] mt-1 mb-5 text-[13.5px] leading-relaxed text-fg-3">{t.todoSub}</p>
        {!todosConfigured() ? (
          <div className="flash" style={{ borderColor: "color-mix(in oklab,var(--warning) 35%,var(--line))", color: "var(--warning)" }}>
            {t.todoNotConfigured}
          </div>
        ) : null}

        <Planner
          rows={rows}
          days={days}
          lang={lang}
          weekLabel={weekLabel}
          weekOffset={weekOffset}
          today={today}
          tomorrow={addDays(today, 1)}
        />

      </div>
    </>
  );
}
