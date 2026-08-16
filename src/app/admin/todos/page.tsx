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
import Link from "next/link";
import { ICON, readCookieFromString } from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { listTodos, todosConfigured } from "@/lib/todoStore";
import { listAccountStatus, listPostLog, listPostTotals } from "@/lib/accountStatus";
import { ACCOUNTS, APPS, PLATFORM_LABEL, accountKey } from "@/lib/socialAccounts";
import { DATE_LOCALE, LANG_COOKIE, normalizeAdminLang, tAdmin } from "../_i18n";
import Planner, { type PlannerDay, type PlannerPosting, type PlannerTodo } from "./Planner";
import PostingBoard, { type BoardAccount, type BoardDay } from "./PostingBoard";
import WeekNav from "./WeekNav";
import { viewHref, type TodoView } from "./views";

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
  searchParams: Promise<{ w?: string; v?: string }>;
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

  // Die Ansicht steht in `?v=`, nicht im Client-State: so lässt sie sich
  // verlinken, überlebt einen Reload, und jede Seite holt nur ihre eigenen
  // Daten statt beide Hälften bei jedem Aufruf.
  const view: TodoView = sp.v === "posting" ? "posting" : "todo";
  const onPosting = view === "posting";

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

  const todos = onPosting ? [] : await listTodos();
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

  // ── Posting-Board ────────────────────────────────────────────────────────
  // Die Account-Liste ist die aus dem Code (lib/socialAccounts) plus die selbst
  // angelegten Zeilen aus der Datenbank — anders liesse sich ein YouTube-Kanal
  // nur per Deploy eintragen. Blotato wird hier bewusst NICHT gefragt und der
  // Profil-Scraper nicht angeworfen: diese Seite geht mehrmals täglich auf, und
  // beides kostet Wartezeit bzw. Guthaben. Was die Plattform selbst zählt,
  // steht auf /admin/content.
  // Beide Ansichten brauchen Accounts und den Wochenverlauf: das Board zeigt
  // sie als Raster, der Wochenplan als Punkte. Nur die Gesamtzahlen sind allein
  // Sache des Boards.
  const [statusByKey, postLog] = await Promise.all([
    listAccountStatus(),
    listPostLog(days[0].iso, days[6].iso),
  ]);
  const postTotals = onPosting ? await listPostTotals() : {};

  const appMeta = new Map(APPS.map((a) => [a.key as string, { label: a.name, color: a.color }]));
  const OTHER = { label: "Weitere", color: "#8C93A8" };

  const fromCode: BoardAccount[] = APPS.flatMap((app) =>
    ACCOUNTS.filter((a) => a.app === app.key).map((a) => {
      const key = accountKey(a);
      const saved = statusByKey.get(key);
      return {
        key,
        handle: a.handle,
        platformLabel: PLATFORM_LABEL[a.platform],
        appLabel: app.name,
        appColor: app.color,
        automated: Boolean(a.blotatoId),
        custom: false,
        // Ohne gepflegte Zeile entscheidet die Rolle im Code: `legacy` heisst
        // aufgegeben. So stimmt das Board schon beim ersten Öffnen.
        state: saved?.state ?? (a.role === "legacy" ? "dropped" : "active"),
        rhythm: saved?.rhythm ?? [],
        format: saved?.format ?? "",
        material: saved?.material ?? "",
        materialReady: saved?.material_ready ?? false,
        niche: saved?.niche ?? "",
        contentGroup: saved?.content_group ?? "",
        steeredRounds: saved?.steered_rounds ?? [],
        perDay: saved?.per_day ?? 1,
        note: saved?.note ?? "",
      };
    }),
  );

  const codeKeys = new Set(fromCode.map((r) => r.key));
  const custom: BoardAccount[] = [...statusByKey.values()]
    .filter((s) => s.handle && s.platform && !codeKeys.has(s.account_key))
    .map((s) => {
      const meta = appMeta.get(s.app ?? "") ?? OTHER;
      return {
        key: s.account_key,
        handle: s.handle ?? "",
        platformLabel: (s.platform ?? "").replace(/^./, (c) => c.toUpperCase()),
        appLabel: meta.label,
        appColor: meta.color,
        automated: false,
        custom: true,
        state: s.state,
        rhythm: s.rhythm,
        format: s.format ?? "",
        material: s.material ?? "",
        materialReady: s.material_ready ?? false,
        niche: s.niche ?? "",
        contentGroup: s.content_group ?? "",
        steeredRounds: s.steered_rounds ?? [],
        perDay: s.per_day ?? 1,
        note: s.note ?? "",
      };
    });

  // Nach App gruppiert ausliefern, damit das Board seine Trennzeilen setzen kann.
  const byApp = [...fromCode, ...custom].sort((a, b) =>
    a.appLabel === b.appLabel ? 0 : a.appLabel < b.appLabel ? -1 : 1,
  );

  // Kanäle desselben Kontos rücken zusammen. Nicht sortiert, sondern
  // eingesammelt: die erste Zeile eines Kontos bleibt, wo sie war, und die
  // übrigen ziehen zu ihr hoch. Eine echte Sortierung nach Kontoname würde die
  // gewachsene Reihenfolge der Account-Liste umwerfen, und das Board zeichnet
  // die Verbindungslinie nur zwischen benachbarten Zeilen — über eine fremde
  // Zeile hinweg wäre sie eine Behauptung, die man nicht nachvollziehen kann.
  const clustered: BoardAccount[] = [];
  const placed = new Set<string>();
  for (const a of byApp) {
    if (placed.has(a.key)) continue;
    clustered.push(a);
    placed.add(a.key);
    if (!a.contentGroup) continue;
    // Nur innerhalb derselben App: quer über die App-Trennzeilen zu ziehen
    // würde eine zweite Kopfzeile derselben App erzeugen. Ein Konto, das über
    // Apps hinweg geht, trägt seinen Namen trotzdem an jeder Zeile — nur die
    // Linie hört an der App-Grenze auf.
    for (const b of byApp) {
      if (placed.has(b.key) || b.appLabel !== a.appLabel) continue;
      if (b.contentGroup !== a.contentGroup) continue;
      clustered.push(b);
      placed.add(b.key);
    }
  }
  const boardAccounts = clustered;

  const boardDays: BoardDay[] = days.map((d) => {
    const dow = new Date(`${d.iso}T12:00:00Z`).getUTCDay();
    return { ...d, dow: dow === 0 ? 7 : dow }; // ISO: Sonntag ist 7, nicht 0
  });

  const log: Record<string, string> = {};
  for (const e of postLog) log[`${e.account_key}|${e.day}|${e.slot}`] = e.note ?? "";

  // Posting-Punkte fuer den Wochenplan: abgeleitet, nicht gespeichert. Wer den
  // Rhythmus aendert, aendert damit die Punkte — ohne dass irgendwo Leichen
  // liegen bleiben.
  const plannerPostings: PlannerPosting[] = onPosting
    ? []
    : boardAccounts
        .filter((a) => a.state === "active" || a.state === "warmup")
        .flatMap((a) =>
          boardDays
            .filter((d) => a.rhythm.includes(d.dow))
            .flatMap((d) =>
              Array.from({ length: a.perDay }, (_, i) => i + 1).map((slot) => ({
                accountKey: a.key,
                day: d.iso,
                slot,
                perDay: a.perDay,
                handle: a.handle,
                format: a.format,
                appLabel: a.appLabel,
                appColor: a.appColor,
                done: `${a.key}|${d.iso}|${slot}` in log,
              })),
            ),
        );

  const platformHints = [
    ...new Set([
      ...ACCOUNTS.map((a) => a.platform as string),
      ...[...statusByKey.values()].map((s) => s.platform ?? "").filter(Boolean),
      "youtube",
      "threads",
      "reddit",
      "pinterest",
    ]),
  ];

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
        {!todosConfigured() ? (
          <div className="flash" style={{ borderColor: "color-mix(in oklab,var(--warning) 35%,var(--line))", color: "var(--warning)" }}>
            {t.todoNotConfigured}
          </div>
        ) : null}

        {/* Umschalter + Wochenzeile: beide Ansichten zeigen dieselbe Woche, also
            wird sie einmal oben bedient und nicht in jeder Ansicht erneut. */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-4 border-b border-line">
          <div className="flex items-center gap-1">
            {(
              [
                { key: "todo", label: t.todoTabPlanner, href: viewHref("todo", weekOffset) },
                { key: "posting", label: t.todoTabPosting, href: viewHref("posting", weekOffset) },
              ] as const
            ).map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] transition-colors ${
                  view === tab.key
                    ? "border-fg font-semibold text-fg"
                    : "border-transparent text-fg-3 hover:text-fg"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <div className="pb-2.5">
            {/* `view` statt einer href-Funktion: Funktionen lassen sich nicht
                an eine Client-Komponente übergeben. */}
            <WeekNav
              lang={lang}
              weekLabel={weekLabel}
              weekOffset={weekOffset}
              today={today}
              view={view}
            />
          </div>
        </div>

        {onPosting ? (
          <PostingBoard
            accounts={boardAccounts}
            days={boardDays}
            apps={[...APPS.map((a) => ({ key: a.key as string, label: a.name })), { key: "studio", label: "Studio" }]}
            log={log}
            totals={postTotals}
            platforms={platformHints}
            today={today}
          />
        ) : (
          <Planner
            rows={rows}
            days={days}
            postings={plannerPostings}
            lang={lang}
            today={today}
            tomorrow={addDays(today, 1)}
          />
        )}
      </div>
    </>
  );
}
