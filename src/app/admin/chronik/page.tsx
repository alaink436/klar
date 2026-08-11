// Klar Control · Chronik — was gelaufen ist, und was du dir vorgenommen hast.
//
// Zwei Blöcke, beide direkt aus dem AI-Brain gelesen:
//   1. Vorgenommen — die Next-Spalte aus STATUS.md, Blocker zuerst. Das sind
//      die selbstgesetzten Ziele; sie stehen oben, weil sie noch offen sind.
//   2. Gelaufen — die Session-Überschriften aus den PROGRESS.md-Dateien der
//      aktiven Projekte, nach Tagen gruppiert.
//
// Bewusst read-only und ohne eigene Datenhaltung: abgehakt und geschrieben
// wird im Vault, diese Seite ist die Zusammenschau. Ohne BRAIN_GITHUB_TOKEN
// bleibt sie leer statt kaputt.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ICON, readCookieFromString } from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { readActiveProjects, readSessions } from "@/lib/brainStatus";
import { LANG_COOKIE, normalizeAdminLang, tAdmin } from "../_i18n";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default async function ChronikPage() {
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
  const [projects, sessions] = await Promise.all([readActiveProjects(20), readSessions(60)]);

  // Ziele: Blocker zuerst, dann der Rest — pro Projekt, damit klar ist, wo es hängt.
  const goals = projects
    .map((p) => ({
      project: p.name,
      blockers: p.blockers.map((b) => b.replace(/\u{1F534}/gu, "").trim()),
      rest: p.next.filter((n) => !n.includes("\u{1F534}")),
    }))
    .filter((g) => g.blockers.length + g.rest.length > 0)
    .sort((a, b) => b.blockers.length - a.blockers.length);

  const openTotal = goals.reduce((s, g) => s + g.blockers.length + g.rest.length, 0);
  const blockedTotal = goals.reduce((s, g) => s + g.blockers.length, 0);

  // Sessions nach Tag gruppieren, jüngster Tag zuerst.
  const byDay = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const arr = byDay.get(s.date);
    if (arr) arr.push(s);
    else byDay.set(s.date, [s]);
  }

  const topbar = `
    <span class="crumb"><b>${t.navChronik}</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="${t.themeToggle}" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>Chronik · Klar Control</title>
      <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
      <div className="content">
        <h1>{t.navChronik}</h1>
        <p className="sub">{t.chronikSub}</p>

        {projects.length === 0 && sessions.length === 0 ? (
          <div className="flash" style={{ borderColor: "color-mix(in oklab,var(--warning) 35%,var(--line))", color: "var(--warning)" }}>
            {t.chronikNoBrain}
          </div>
        ) : null}

        {/* ── Vorgenommen ── */}
        {goals.length > 0 ? (
          <div className="card" style={{ padding: 0, display: "block", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "18px 22px 13px" }}>
              <span className="k" style={{ margin: 0 }}>{t.chronikGoals}</span>
              <span className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                {t.chronikGoalsMeta(openTotal, blockedTotal)}
              </span>
            </div>
            {goals.map((g) => (
              <div key={g.project} style={{ padding: "12px 22px", borderTop: "1px solid var(--line)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginBottom: 6 }}>{g.project}</div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {g.blockers.map((b, i) => (
                    <li key={`b${i}`} style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "3px 0" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: ".1em",
                          color: "var(--danger)",
                          flexShrink: 0,
                        }}
                      >
                        {t.chronikBlocked}
                      </span>
                      <span style={{ fontSize: 12.5, color: "var(--fg-2)" }}
                        dangerouslySetInnerHTML={{ __html: esc(b) }} />
                    </li>
                  ))}
                  {g.rest.map((n, i) => (
                    <li key={`n${i}`} style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "3px 0" }}>
                      <span style={{ color: "var(--fg-4)", flexShrink: 0, fontSize: 12 }}>·</span>
                      <span style={{ fontSize: 12.5, color: "var(--fg-3)" }}
                        dangerouslySetInnerHTML={{ __html: esc(n) }} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        {/* ── Gelaufen ── */}
        {sessions.length > 0 ? (
          <div className="card" style={{ padding: 0, display: "block" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "18px 22px 13px" }}>
              <span className="k" style={{ margin: 0 }}>{t.chronikSessions}</span>
              <span className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                {t.chronikSessionsMeta(sessions.length, byDay.size)}
              </span>
            </div>
            {[...byDay.entries()].map(([day, items]) => (
              <div key={day} style={{ borderTop: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px 6px", background: "var(--surface-2)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", color: "var(--fg-3)" }}>
                    {day}
                  </span>
                  <span className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 9.5 }}>{items.length}</span>
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: "6px 22px 10px" }}>
                  {items.map((s, i) => (
                    <li key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "3px 0" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: "var(--fg-4)",
                          minWidth: 96,
                          flexShrink: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.project}
                      </span>
                      <span style={{ fontSize: 12.5, color: "var(--fg-2)" }}>{s.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
