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
import { requireAdminPage } from "../../../lib/adminGuard";
import { readCookie } from "../../../lib/adminSession";
import { readActiveProjects, readSessions } from "@/lib/brainReader";
import { LANG_COOKIE, normalizeAdminLang, tAdmin } from "../_i18n";
import { Clock } from "lucide-react";
import { TextureCard, TextureCardHeader, TextureCardTitle } from "@/components/ui/texture-card";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";

import { AdminTopbar } from "../AdminTopbar";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ChronikPage() {
  await requireAdminPage();
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";

  const lang = normalizeAdminLang(readCookie(cookieHeader, LANG_COOKIE));
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

  return (
    <>
      <title>Chronik · Klar Control</title>
      <AdminTopbar titel={t.navChronik} />
      <div className="content">
        <PageHeader eyebrow="Klar Control" icon={<Clock />} title={t.navChronik} />

        {projects.length === 0 && sessions.length === 0 ? <Notice tone="warn">{t.chronikNoBrain}</Notice> : null}

        {/* ── Vorgenommen ── */}
        {goals.length > 0 ? (
          <TextureCard className="mb-5">
            <TextureCardHeader className="justify-start gap-x-3 pb-3.5">
              <TextureCardTitle>{t.chronikGoals}</TextureCardTitle>
              <span className="[font-family:var(--font-mono)] text-[11px] text-fg-3">{t.chronikGoalsMeta(openTotal, blockedTotal)}</span>
            </TextureCardHeader>
            {goals.map((g) => (
              <div key={g.project} className="border-t border-line px-6 py-3.5">
                <div className="mb-2 text-[13.5px] font-medium text-fg">{g.project}</div>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {g.blockers.map((b, i) => (
                    <li key={`b${i}`} className="flex items-baseline gap-2.5">
                      <Badge tone="danger" className="relative top-px h-5 shrink-0 px-2 text-[10.5px]">
                        {t.chronikBlocked}
                      </Badge>
                      {/* Stand hier als dangerouslySetInnerHTML mit einem
                          eigenen esc() davor. In JSX ist das genau {b}, nur
                          umstaendlicher, und es wird zur Luecke, sobald jemand
                          das esc() vergisst. Die Hilfsfunktion ist mit weg. */}
                      <span className="text-[13px] text-fg-2">{b}</span>
                    </li>
                  ))}
                  {g.rest.map((n, i) => (
                    <li key={`n${i}`} className="flex items-baseline gap-2.5">
                      <span className="shrink-0 text-[12px] text-fg-4">·</span>
                      <span className="text-[13px] text-fg-3">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </TextureCard>
        ) : null}

        {/* ── Gelaufen ── */}
        {sessions.length > 0 ? (
          <TextureCard>
            <TextureCardHeader className="justify-start gap-x-3 pb-3.5">
              <TextureCardTitle>{t.chronikSessions}</TextureCardTitle>
              <span className="[font-family:var(--font-mono)] text-[11px] text-fg-3">
                {t.chronikSessionsMeta(sessions.length, byDay.size)}
              </span>
            </TextureCardHeader>
            {[...byDay.entries()].map(([day, items]) => (
              <div key={day} className="border-t border-line">
                <div className="flex items-center gap-2 bg-white/[.025] px-6 pb-1.5 pt-2.5">
                  <span className="[font-family:var(--font-mono)] text-[10.5px] font-medium tracking-[0.1em] text-fg-3">{day}</span>
                  <span className="[font-family:var(--font-mono)] text-[10px] text-fg-4">{items.length}</span>
                </div>
                <ul className="m-0 flex list-none flex-col gap-1 px-6 pb-3 pt-2">
                  {items.map((s, i) => (
                    <li key={i} className="flex items-baseline gap-2.5">
                      <span className="min-w-24 shrink-0 truncate [font-family:var(--font-mono)] text-[10.5px] text-fg-4">{s.project}</span>
                      <span className="text-[13px] text-fg-2">{s.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </TextureCard>
        ) : null}
      </div>
    </>
  );
}
