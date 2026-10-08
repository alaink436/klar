// Klar Control · Klar Studios · Feedback — was Nutzer an die Support-Adressen
// der Apps schreiben: Vorschlaege, Beschwerden, Fragen.
//
// Die Gmail-Postfaecher aus den Apps und Store-Eintraegen leiten an
// feedback+<app>@reply.getklar.org weiter, /api/inbound/brevo legt jede Mail in
// `klar_app_feedback` ab (lib/feedbackStore). Hier wird gelesen und abgehakt.
// Geantwortet wird aus dem eigenen Mailprogramm, damit die Antwort vom
// Support-Postfach der App kommt und nicht von einer Klar-Adresse.
//
// Seit dem Redesign (2026-10-08, Ticket 02) aus den gemeinsamen Bausteinen:
// Seitenkopf, TextureCard, Filter als `.klar-segment`, Pillen-Knoepfe, Stand
// einer Meldung als gedaempfter Punkt.

import { Check, Mail, MessageCircle } from "lucide-react";
import { requireAdminPage } from "../../../lib/adminGuard";
import { FEEDBACK_APPS, feedbackAppName, listFeedback, type AppFeedback } from "@/lib/feedbackStore";
import { TextureCard } from "@/components/ui/texture-card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { inZone, tagInZone } from "@/lib/zeit";
import { AdminTopbar } from "../AdminTopbar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function wann(iso: string): string {
  const tag = tagInZone(iso);
  if (!tag) return "";
  const heute = tagInZone(new Date());
  if (tag === heute) return inZone(iso, { hour: "2-digit", minute: "2-digit" });
  return inZone(iso, { day: "2-digit", month: "short" });
}

const zeitpunkt = (iso: string) =>
  inZone(iso, { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const adresse = (f: { erledigt: boolean; app: string | null; id?: string }) => {
  const p = new URLSearchParams();
  if (f.id) p.set("id", f.id);
  if (f.erledigt) p.set("ordner", "erledigt");
  if (f.app) p.set("app", f.app);
  const q = p.toString();
  return q ? `/admin/feedback?${q}` : "/admin/feedback";
};

// Ein Filter im `.klar-segment`: das Aussehen kommt aus admin.css, aktiv
// heisst aria-current.
function Pille({ href, aktiv, children }: { href: string; aktiv: boolean; children: React.ReactNode }) {
  return (
    <a href={href} aria-current={aktiv ? "page" : undefined}>
      {children}
    </a>
  );
}

/** Kurze Meldung in einer Karte; ihr Ton steckt nur im Punkt. */
function Meldung({ ton, children }: { ton?: string; children: React.ReactNode }) {
  return (
    <TextureCard className="mb-4 flex items-start gap-3 px-5 py-4 text-[13px] text-fg-2">
      {ton ? (
        <span aria-hidden="true" className="klar-punkt mt-[7px]" style={{ "--ton": ton } as React.CSSProperties} />
      ) : null}
      <div className="min-w-0">{children}</div>
    </TextureCard>
  );
}

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; ordner?: string; app?: string; stand?: string; msg?: string }>;
}) {
  await requireAdminPage();

  const roh = await searchParams;
  const erledigt = roh.ordner === "erledigt";
  const app = FEEDBACK_APPS.some((a) => a.slug === roh.app) ? roh.app! : null;
  const msg = (roh.msg ?? "").slice(0, 400);
  const stand = roh.stand === "fehler" ? "fehler" : roh.stand === "ok" ? "ok" : null;

  const liste = await listFeedback({ done: erledigt, app });
  const eintraege = liste ?? [];
  const gewaehlt = eintraege.find((e) => e.id === roh.id) ?? null;

  return (
    <>
      <title>Feedback · Klar Studios · Klar Control</title>
      <AdminTopbar titel="Feedback" bereich="Klar Studios" />
      <div className="content">
        <PageHeader eyebrow="Klar Studios · Support-Postfächer der Apps" icon={<MessageCircle />} title="Feedback">
          Vorschläge, Beschwerden und Fragen, die Nutzer an die Support-Adressen der Apps schreiben.
          Antworten geht über das Mailprogramm, damit die Antwort vom Postfach der App kommt.
        </PageHeader>

        {liste === null ? (
          <Meldung ton="var(--danger)">
            <b className="text-fg">Feedback nicht lesbar.</b> Fehlt <code>KLAR_INBOX_SERVICE_KEY</code>, oder ist Migration{" "}
            <code>0040_app_feedback</code> noch nicht eingespielt?
          </Meldung>
        ) : null}

        {msg ? (
          <Meldung ton={stand === "fehler" ? "var(--danger)" : stand === "ok" ? "var(--success)" : undefined}>{msg}</Meldung>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <TextureCard className="self-start">
            <div className="flex flex-col items-start gap-2 border-b px-4 py-3.5">
              <div className="klar-segment">
                <Pille href={adresse({ erledigt: false, app })} aktiv={!erledigt}>Offen</Pille>
                <Pille href={adresse({ erledigt: true, app })} aktiv={erledigt}>Erledigt</Pille>
              </div>
              <div className="klar-segment">
                <Pille href={adresse({ erledigt, app: null })} aktiv={!app}>Alle Apps</Pille>
                {FEEDBACK_APPS.map((a) => (
                  <Pille key={a.slug} href={adresse({ erledigt, app: a.slug })} aktiv={app === a.slug}>
                    {a.name}
                  </Pille>
                ))}
              </div>
            </div>
            {eintraege.length === 0 ? (
              <p className="m-0 px-4 py-8 text-center text-[12.5px] text-fg-3">
                {erledigt ? "Nichts erledigt." : "Kein offenes Feedback."}
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {eintraege.map((e) => (
                  <li key={e.id} className="border-t first:border-t-0">
                    <a
                      href={adresse({ erledigt, app, id: e.id })}
                      className={cn(
                        "block px-4 py-3 transition-colors hover:bg-white/[.03]",
                        e.id === gewaehlt?.id && "bg-white/[.045] shadow-[inset_2px_0_0_0_var(--fg)] hover:bg-white/[.045]",
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-fg">
                          {e.contact_name || e.contact_email}
                        </span>
                        <span className="shrink-0 text-[11px] text-fg-4 [font-family:var(--font-mono)]">{wann(e.sent_at ?? e.created_at)}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[12.5px] text-fg-2">{e.subject || "Ohne Betreff"}</div>
                      <div className="mt-0.5 truncate text-[12px] text-fg-4">
                        {feedbackAppName(e.app)} · {e.body.slice(0, 120) || "Kein Text"}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </TextureCard>

          <TextureCard className="min-w-0 self-start p-6">
            {gewaehlt ? (
              <Eintrag e={gewaehlt} erledigt={erledigt} app={app} />
            ) : (
              <p className="m-0 py-10 text-center text-[13px] text-fg-3">Links eine Mail auswählen.</p>
            )}
          </TextureCard>
        </div>
      </div>
    </>
  );
}

function Eintrag({ e, erledigt, app }: { e: AppFeedback; erledigt: boolean; app: string | null }) {
  const antwort = `mailto:${e.contact_email}?subject=${encodeURIComponent(`Re: ${e.subject ?? ""}`)}`;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div className="min-w-0">
          <h2 className="m-0 block text-[18px] font-medium normal-case leading-tight tracking-[-0.015em] text-fg [font-family:var(--font-body)] after:hidden">
            {e.subject || "Ohne Betreff"}
          </h2>
          <p className="mt-1.5 text-[12.5px] text-fg-3">
            {e.contact_name ? `${e.contact_name} · ` : ""}
            {e.contact_email} · {feedbackAppName(e.app)}
            {e.inbox ? ` · an ${e.inbox}` : ""} · {zeitpunkt(e.sent_at ?? e.created_at)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="pill-dark" size="sm">
            <a href={antwort}>
              <Mail />
              Antworten
            </a>
          </Button>
          <form method="POST" action="/admin/feedback/aktion">
            <input type="hidden" name="id" value={e.id} />
            <input type="hidden" name="erledigt" value={erledigt ? "0" : "1"} />
            <input type="hidden" name="ordner" value={erledigt ? "erledigt" : ""} />
            <input type="hidden" name="app" value={app ?? ""} />
            <Button type="submit" variant="pill" size="sm">
              {erledigt ? null : <Check />}
              {erledigt ? "Wieder öffnen" : "Erledigt"}
            </Button>
          </form>
        </div>
      </div>
      <div className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.75] text-fg">{e.body || "Kein Text."}</div>
    </div>
  );
}
