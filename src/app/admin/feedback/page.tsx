// Klar Control · Klar Studios · Feedback — was Nutzer an die Support-Adressen
// der Apps schreiben: Vorschlaege, Beschwerden, Fragen.
//
// Die Gmail-Postfaecher aus den Apps und Store-Eintraegen leiten an
// feedback+<app>@reply.getklar.org weiter, /api/inbound/brevo legt jede Mail in
// `klar_app_feedback` ab (lib/feedbackStore). Hier wird gelesen und abgehakt.
// Geantwortet wird aus dem eigenen Mailprogramm, damit die Antwort vom
// Support-Postfach der App kommt und nicht von einer Klar-Adresse.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { readCookieFromString } from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { FEEDBACK_APPS, feedbackAppName, listFeedback, type AppFeedback } from "@/lib/feedbackStore";
import { Card } from "@/components/ui/card";
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

// Farbe als Inline-Stil, nicht als Klasse: `_shared.ts` setzt `a{color:inherit}`
// ungeschichtet, und das schlaegt jede text-*-Klasse auf einem Link.
function Pille({ href, aktiv, children }: { href: string; aktiv: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={cn("rounded-[var(--radius-sm)] px-2.5 py-1 text-[12px]", aktiv ? "bg-fg" : "hover:bg-surface-2")}
      style={{ color: aktiv ? "var(--accent-fg)" : "var(--fg-3)" }}
    >
      {children}
    </a>
  );
}

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; ordner?: string; app?: string; stand?: string; msg?: string }>;
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
        <div className="mb-6">
          <div className="mb-2 [font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.24em] text-fg-4">
            Klar Studios · Support-Postfächer der Apps
          </div>
          <h1 className="m-0 [font-family:var(--font-display)] text-[clamp(36px,5vw,58px)] font-normal leading-[0.92] tracking-[0.015em] text-fg">
            Feedback
          </h1>
          <p className="mt-3 max-w-[64ch] text-[13px] leading-relaxed text-fg-3">
            Vorschläge, Beschwerden und Fragen, die Nutzer an die Support-Adressen der Apps schreiben.
            Antworten geht über das Mailprogramm, damit die Antwort vom Postfach der App kommt.
          </p>
        </div>

        {liste === null ? (
          <Card className="mb-4 border-[var(--danger)]/40 p-4 text-[13px]">
            <b>Feedback nicht lesbar.</b> Fehlt <code>KLAR_INBOX_SERVICE_KEY</code>, oder ist Migration{" "}
            <code>0040_app_feedback</code> noch nicht eingespielt?
          </Card>
        ) : null}

        {msg ? (
          <Card
            className={cn(
              "mb-4 p-4 text-[13px]",
              stand === "fehler" ? "border-[var(--danger)]/40" : stand === "ok" ? "border-emerald-500/40" : "",
            )}
          >
            {msg}
          </Card>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Card className="self-start overflow-hidden p-0">
            <div className="flex gap-1 border-b border-line px-3 py-2">
              <Pille href={adresse({ erledigt: false, app })} aktiv={!erledigt}>Offen</Pille>
              <Pille href={adresse({ erledigt: true, app })} aktiv={erledigt}>Erledigt</Pille>
            </div>
            <div className="flex flex-wrap gap-1 border-b border-line px-3 py-2">
              <Pille href={adresse({ erledigt, app: null })} aktiv={!app}>Alle Apps</Pille>
              {FEEDBACK_APPS.map((a) => (
                <Pille key={a.slug} href={adresse({ erledigt, app: a.slug })} aktiv={app === a.slug}>
                  {a.name}
                </Pille>
              ))}
            </div>
            {eintraege.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12.5px] text-fg-3">
                {erledigt ? "Nichts erledigt." : "Kein offenes Feedback."}
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {eintraege.map((e) => (
                  <li key={e.id}>
                    <a
                      href={adresse({ erledigt, app, id: e.id })}
                      className={cn(
                        "block border-l-2 px-3.5 py-3 hover:bg-surface-2",
                        e.id === gewaehlt?.id ? "border-l-fg bg-surface-2" : "border-l-transparent",
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold text-fg">
                          {e.contact_name || e.contact_email}
                        </span>
                        <span className="shrink-0 text-[11.5px] text-fg-4">{wann(e.sent_at ?? e.created_at)}</span>
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
          </Card>

          <Card className="min-w-0 self-start p-5">
            {gewaehlt ? (
              <Eintrag e={gewaehlt} erledigt={erledigt} app={app} />
            ) : (
              <p className="py-10 text-center text-[13px] text-fg-3">Links eine Mail auswählen.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Eintrag({ e, erledigt, app }: { e: AppFeedback; erledigt: boolean; app: string | null }) {
  const antwort = `mailto:${e.contact_email}?subject=${encodeURIComponent(`Re: ${e.subject ?? ""}`)}`;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div className="min-w-0">
          <h2 className="m-0 text-[18px] font-semibold leading-tight text-fg">{e.subject || "Ohne Betreff"}</h2>
          <p className="mt-1.5 text-[12.5px] text-fg-3">
            {e.contact_name ? `${e.contact_name} · ` : ""}
            {e.contact_email} · {feedbackAppName(e.app)}
            {e.inbox ? ` · an ${e.inbox}` : ""} · {zeitpunkt(e.sent_at ?? e.created_at)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline" size="sm">
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
            <Button type="submit" size="sm">
              {erledigt ? "Wieder öffnen" : "Erledigt"}
            </Button>
          </form>
        </div>
      </div>
      <div className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.75] text-fg">{e.body || "Kein Text."}</div>
    </div>
  );
}
