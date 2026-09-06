// Klar Control · MyCakeDay — das Postfach von mycakeday.ch, von hier aus.
//
// Eigener Menuepunkt und kein Filter in der Inbox: MyCakeDay ist ein eigenes
// Geschaeft mit eigener Domain, eigener Datenbank und eigenen Kundinnen. Die
// Inbox traegt, was an Klar geht; hier steht, was an hallo@mycakeday.ch geht.
//
// Alle Daten kommen ueber die Betriebs-API von mycakeday.ch (lib/cakeday.ts),
// und jede Aktion (Antwort, Erledigt, neue Mail) laeuft dort durch dieselben
// Funktionen wie im Cakeday-Dashboard selbst. Klar Control hat keinen
// Service-Key fuer die Cakeday-Datenbank und braucht keinen.
//
// Gebaut wie die Cakeday-Seite: Server-Komponente, Ordner und Suche in der
// Adresse, Formulare als gewoehnliche POSTs auf /admin/mycakeday/aktion. Wer
// mehr will als Post (Firmen, Partner, Sortiment), springt mit „Oeffnen" ohne
// zweiten Login ins Cakeday-Dashboard (/admin/mycakeday/oeffnen).

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowUpRight, Paperclip, Reply } from "lucide-react";
import { readCookieFromString } from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import {
  cakedayFaden,
  cakedayFaeden,
  cakedayReady,
  type CakedayFaden,
  type CakedayNachricht,
  type CakedayOrdner,
} from "@/lib/cakeday";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminTopbar } from "../AdminTopbar";
import { MailRahmen } from "./MailRahmen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORDNER: { id: CakedayOrdner; titel: string }[] = [
  { id: "offen", titel: "Offen" },
  { id: "erledigt", titel: "Erledigt" },
  { id: "alle", titel: "Alle" },
];

const eingabe =
  "w-full px-3 py-2 text-[13px] bg-bg text-fg border border-line-strong rounded-[var(--radius-sm)] focus:border-fg focus:outline-none";
const etikett =
  "[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-3";

function wann(iso: string): string {
  const d = new Date(iso);
  const jetzt = new Date();
  if (d.toDateString() === jetzt.toDateString())
    return d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
  if (d.getFullYear() === jetzt.getFullYear())
    return d.toLocaleDateString("de-CH", { day: "2-digit", month: "short" });
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

const zeitpunkt = (iso: string) =>
  new Date(iso).toLocaleString("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const groesse = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Wie lange der Faden schon auf eine Antwort wartet — ab einem Tag. */
function wartet(f: CakedayFaden): string | null {
  if (f.erledigt || f.letzteRichtung !== "ein") return null;
  const tage = Math.floor((Date.now() - new Date(f.letzteAm).getTime()) / 86_400_000);
  if (tage < 1) return null;
  if (tage === 1) return "seit gestern";
  if (tage < 14) return `seit ${tage} Tagen`;
  return `seit ${Math.round(tage / 7)} Wochen`;
}

const adresse = (f: { ordner: CakedayOrdner; suche: string; faden?: string }) => {
  const p = new URLSearchParams();
  if (f.faden) p.set("faden", f.faden);
  if (f.ordner !== "offen") p.set("ordner", f.ordner);
  if (f.suche) p.set("suche", f.suche);
  const q = p.toString();
  return q ? `/admin/mycakeday?${q}` : "/admin/mycakeday";
};

export default async function MyCakeDayPage({
  searchParams,
}: {
  searchParams: Promise<{ faden?: string; ordner?: string; suche?: string; stand?: string; msg?: string }>;
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
  const gewaehlt = (roh.faden ?? "").trim() || null;
  const ordner: CakedayOrdner = ORDNER.some((o) => o.id === roh.ordner) ? (roh.ordner as CakedayOrdner) : "offen";
  const suche = (roh.suche ?? "").slice(0, 120);
  const msg = (roh.msg ?? "").slice(0, 400);
  const stand = roh.stand === "ok" ? "ok" : roh.stand === "fehler" ? "fehler" : null;

  const bereit = cakedayReady();
  const [liste, faden] = bereit
    ? await Promise.all([
        cakedayFaeden({ ordner, suche }),
        // Abhaken beim Oeffnen, wie im Cakeday-Dashboard: `gelesen=1`.
        gewaehlt ? cakedayFaden(gewaehlt, true) : Promise.resolve(null),
      ])
    : [null, null];

  const faeden = liste?.daten?.faeden ?? [];
  const kopf = faden?.daten?.faden ?? null;
  const nachrichten = faden?.daten?.nachrichten ?? [];
  const absender = liste?.daten?.absender ?? "hallo@mycakeday.ch";
  const oeffnen = `/admin/mycakeday/oeffnen?weiter=${encodeURIComponent(
    gewaehlt ? `/admin/postfach?faden=${gewaehlt}` : "/admin/postfach",
  )}`;

  return (
    <>
      <title>MyCakeDay · Klar Control</title>
      <AdminTopbar
        titel="MyCakeDay"
        rechts={
          <Button asChild variant="ghost" size="sm" className="ml-2">
            {/* Ein Route-Handler, der einen einmaligen Anmeldelink holt und
                dorthin umleitet — deshalb ein schlichtes <a> und ein neuer Tab. */}
            <a href={oeffnen} target="_blank" rel="noopener">
              mycakeday.ch öffnen
              <ArrowUpRight className="opacity-60" />
            </a>
          </Button>
        }
      />
      <div className="content">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 [font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.24em] text-fg-4">
              Postfach · {absender}
            </div>
            <h1 className="m-0 [font-family:var(--font-display)] text-[clamp(36px,5vw,58px)] font-normal leading-[0.92] tracking-[0.015em] text-fg">
              MyCakeDay
            </h1>
            <p className="mt-3 max-w-[64ch] text-[13px] leading-relaxed text-fg-3">
              Echte Post an mycakeday.ch: lesen, antworten, abhaken. Firmen, Partner und Sortiment
              stehen im Cakeday-Dashboard — „mycakeday.ch öffnen“ bringt dich ohne zweiten Login hin.
            </p>
          </div>
        </div>

        {!bereit ? (
          <Card className="p-5 text-[13px] leading-relaxed">
            <b>Noch nicht verbunden.</b> In Vercel von Klar <code>CAKEDAY_KLAR_SECRET</code> setzen
            (dasselbe Geheimnis wie <code>CAKEDAY_KLAR_SECRET</code> bei mycakeday.ch), optional{" "}
            <code>CAKEDAY_URL</code>. Danach neu ausrollen.
          </Card>
        ) : null}

        {bereit && liste && !liste.ok ? (
          <Card className="mb-4 border-[var(--danger)]/40 p-4 text-[13px]">
            <b>mycakeday.ch antwortet nicht:</b> {liste.meldung}
          </Card>
        ) : null}

        {liste?.daten && !liste.daten.empfangBereit ? (
          <Card className="mb-4 p-4 text-[12.5px] text-fg-3">
            Bei mycakeday.ch fehlt <code>RESEND_WEBHOOK_SECRET</code> — es kommt dort noch nichts herein.
            Senden geht trotzdem.
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

        {bereit ? (
          <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            {/* ── Liste ─────────────────────────────────────────────── */}
            <Card className="p-0 overflow-hidden self-start">
              <form method="GET" action="/admin/mycakeday" className="border-b border-line p-3">
                {ordner !== "offen" ? <input type="hidden" name="ordner" value={ordner} /> : null}
                <input
                  name="suche"
                  defaultValue={suche}
                  placeholder="Suchen"
                  aria-label="Im Postfach suchen"
                  className={eingabe}
                />
              </form>
              <div className="flex gap-1 border-b border-line px-3 py-2">
                {ORDNER.map((o) => (
                  <a
                    key={o.id}
                    href={adresse({ ordner: o.id, suche })}
                    className={cn(
                      "rounded-[var(--radius-sm)] px-2.5 py-1 text-[12px]",
                      o.id === ordner ? "bg-fg text-accent-fg" : "text-fg-3 hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    {o.titel}
                  </a>
                ))}
              </div>
              {faeden.length === 0 ? (
                <p className="px-4 py-8 text-center text-[12.5px] text-fg-3">
                  {suche ? "Kein Treffer." : ordner === "erledigt" ? "Nichts erledigt." : "Keine Post."}
                </p>
              ) : (
                <ul className="m-0 list-none p-0">
                  {faeden.map((f) => {
                    const ungelesen = f.ungelesen > 0;
                    const aktiv = f.faden === gewaehlt;
                    const offenSeit = wartet(f);
                    return (
                      <li key={f.faden}>
                        <a
                          href={adresse({ ordner, suche, faden: f.faden })}
                          className={cn(
                            "block border-l-2 px-3.5 py-3 hover:bg-surface-2",
                            aktiv
                              ? "border-l-fg bg-surface-2"
                              : ungelesen
                                ? "border-l-[var(--accent)]"
                                : "border-l-transparent",
                          )}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className={cn("truncate text-[13px]", ungelesen ? "font-semibold text-fg" : "text-fg-2")}>
                              {f.anzeige}
                            </span>
                            <span className="shrink-0 text-[11.5px] text-fg-4">{wann(f.letzteAm)}</span>
                          </div>
                          <div className={cn("mt-0.5 flex items-center gap-1 truncate text-[12.5px]", ungelesen ? "text-fg" : "text-fg-3")}>
                            {f.letzteRichtung === "aus" ? <Reply className="size-3 shrink-0 opacity-60" /> : null}
                            <span className="truncate">{f.betreff}</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-fg-4">
                            {f.hatAnhaenge ? <Paperclip className="size-3 shrink-0" /> : null}
                            <span className="truncate">{f.vorschau || "Kein Text"}</span>
                          </div>
                          {offenSeit ? (
                            <span className="mt-1.5 inline-block rounded-full bg-yellow-50 px-2 py-[1px] text-[11px] text-yellow-900 ring-1 ring-inset ring-yellow-600/30 dark:bg-yellow-400/10 dark:text-yellow-500">
                              wartet {offenSeit}
                            </span>
                          ) : null}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {/* ── Faden ─────────────────────────────────────────────── */}
            <Card className="p-5 self-start min-w-0">
              {!kopf || nachrichten.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-fg-3">
                  {gewaehlt && faden && !faden.ok
                    ? `Faden nicht lesbar: ${faden.meldung}`
                    : "Links einen Faden auswählen, oder unten eine neue Mail schreiben."}
                </p>
              ) : (
                <Faden kopf={kopf} nachrichten={nachrichten} ordner={ordner} suche={suche} />
              )}
            </Card>
          </div>
        ) : null}

        {bereit ? (
          <Card className="mt-4 p-0 overflow-hidden">
            <details>
              <summary className="cursor-pointer select-none px-5 py-3.5 text-[13px] font-semibold text-fg-2 marker:content-none">
                + Neue Mail schreiben
              </summary>
              <form method="POST" action="/admin/mycakeday/aktion" className="grid gap-3 px-5 pb-5 md:grid-cols-3">
                <input type="hidden" name="aktion" value="neu" />
                <input type="hidden" name="ordner" value={ordner} />
                <p className="text-[12px] text-fg-3 md:col-span-3">
                  Geht hinaus als <b>{absender}</b>. Die Antwort landet wieder hier.
                </p>
                <label className="flex flex-col gap-1">
                  <span className={etikett}>An</span>
                  <input name="an" type="email" required maxLength={160} className={eingabe} />
                </label>
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className={etikett}>Betreff</span>
                  <input name="betreff" required maxLength={200} className={eingabe} />
                </label>
                <label className="flex flex-col gap-1 md:col-span-3">
                  <span className={etikett}>Text</span>
                  <textarea name="text" required maxLength={20000} rows={7} className={eingabe} />
                </label>
                <div className="md:col-span-3">
                  <Button type="submit" size="sm" disabled={liste?.daten ? !liste.daten.sendenBereit : false}>
                    Senden
                  </Button>
                  {liste?.daten && !liste.daten.sendenBereit ? (
                    <span className="ml-3 text-[12px] text-fg-3">
                      Bei mycakeday.ch fehlt <code>RESEND_API_KEY</code> oder <code>CAKEDAY_ABSENDER</code>.
                    </span>
                  ) : null}
                </div>
              </form>
            </details>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function Faden({
  kopf,
  nachrichten,
  ordner,
  suche,
}: {
  kopf: CakedayFaden;
  nachrichten: CakedayNachricht[];
  ordner: CakedayOrdner;
  suche: string;
}) {
  const letzte = nachrichten.length - 1;
  // Offen steht die letzte Nachricht und jede ungelesene; der Rest zugeklappt.
  const offen = (n: CakedayNachricht, i: number) => i === letzte || (n.richtung === "ein" && n.gelesenAm === null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div className="min-w-0">
          <h2 className="m-0 text-[18px] font-semibold leading-tight text-fg">{kopf.betreff}</h2>
          <p className="mt-1.5 text-[12.5px] text-fg-3">
            {kopf.anzeige}
            {kopf.anzeige !== kopf.gegenstelle ? ` · ${kopf.gegenstelle}` : ""}
            {kopf.postfach ? ` · an ${kopf.postfach}` : ""}
            {nachrichten.length > 1 ? ` · ${nachrichten.length} Nachrichten` : ""}
          </p>
        </div>
        <form method="POST" action="/admin/mycakeday/aktion" className="shrink-0">
          <input type="hidden" name="aktion" value={kopf.erledigt ? "offen" : "erledigt"} />
          <input type="hidden" name="faden" value={kopf.faden} />
          <input type="hidden" name="ordner" value={ordner} />
          <input type="hidden" name="suche" value={suche} />
          <Button type="submit" variant="outline" size="sm">
            {kopf.erledigt ? "Wieder öffnen" : "Erledigt"}
          </Button>
        </form>
      </div>

      <div className="divide-y divide-[var(--line)] border-y border-line">
        {nachrichten.map((n, i) => {
          const eigen = n.richtung === "aus";
          const zeigen = offen(n, i);
          const kopfzeile = (
            <>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[13px] font-semibold text-fg">{n.name}</span>
                  {!eigen && n.name !== n.von ? <span className="truncate text-[12px] text-fg-3">{n.von}</span> : null}
                  {n.gelesenAm === null && !eigen ? (
                    <span className="rounded-full bg-[var(--accent)]/15 px-2 py-[1px] text-[11px] text-fg">neu</span>
                  ) : null}
                </span>
                <span className={cn("mt-0.5 block truncate text-[12px] text-fg-3", !zeigen && "group-open:block hidden")}>
                  an {n.an.join(", ") || kopf.gegenstelle}
                  {n.cc.length > 0 ? ` · Kopie an ${n.cc.join(", ")}` : ""}
                </span>
                {!zeigen ? (
                  <span className="mt-0.5 block truncate text-[12px] text-fg-3 group-open:hidden">
                    {n.vorschau || "Kein Text"}
                  </span>
                ) : null}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-[12px] text-fg-4">
                {n.anhaenge.length > 0 ? <Paperclip className="size-3" /> : null}
                {zeigen ? zeitpunkt(n.gesendetAm) : wann(n.gesendetAm)}
              </span>
            </>
          );

          const rumpf = (
            <div className="pb-4 pr-1">
              {n.fehler ? (
                <p className="mb-3 rounded-[var(--radius-sm)] border border-[var(--danger)]/40 px-3 py-2 text-[12.5px]">
                  Diese Mail ging nicht hinaus: {n.fehler}
                </p>
              ) : null}
              {n.html ? (
                <MailRahmen html={n.html} bilderBlockiert={n.bilderBlockiert} />
              ) : (
                <div className="whitespace-pre-wrap text-[13.5px] leading-[1.75] text-fg">{n.text || "Kein Text."}</div>
              )}
              {n.zitatHtml || n.zitatText ? (
                <details className="mt-3">
                  <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] border border-line px-2 py-[3px] text-[11.5px] text-fg-3 hover:bg-surface-2">
                    <span aria-hidden className="leading-none tracking-[0.15em]">···</span>
                    Zitierte Vorgeschichte
                  </summary>
                  <div className="mt-2 border-l-2 border-line pl-3">
                    {n.zitatHtml ? (
                      <MailRahmen html={n.zitatHtml} bilderBlockiert={0} />
                    ) : (
                      <div className="whitespace-pre-wrap text-[12.5px] leading-[1.7] text-fg-3">{n.zitatText}</div>
                    )}
                  </div>
                </details>
              ) : null}
              {n.anhaenge.length > 0 && n.resendId ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {n.anhaenge.map((a) => (
                    <a
                      key={a.id}
                      href={`/admin/mycakeday/anhang?mail=${encodeURIComponent(n.resendId!)}&id=${encodeURIComponent(a.id)}`}
                      className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2 text-[12.5px] text-fg hover:bg-surface-2"
                    >
                      <Paperclip className="size-3 shrink-0" />
                      <span className="max-w-[220px] truncate">{a.name}</span>
                      <span className="shrink-0 tabular-nums text-fg-4">{groesse(a.groesse)}</span>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          );

          const flaeche = eigen ? "bg-surface-2/50" : "";
          if (zeigen) {
            return (
              <div key={n.id} className={flaeche}>
                <div className="flex items-start gap-3 px-1 pb-3 pt-4">{kopfzeile}</div>
                <div className="px-1">{rumpf}</div>
              </div>
            );
          }
          return (
            <details key={n.id} className={cn("group", flaeche)}>
              <summary className="flex cursor-pointer list-none items-start gap-3 px-1 py-2.5 hover:bg-surface-2 marker:content-none">
                {kopfzeile}
              </summary>
              <div className="px-1">{rumpf}</div>
            </details>
          );
        })}
      </div>

      <form method="POST" action="/admin/mycakeday/aktion" className="space-y-2">
        <input type="hidden" name="aktion" value="antwort" />
        <input type="hidden" name="faden" value={kopf.faden} />
        <input type="hidden" name="ordner" value={ordner} />
        <input type="hidden" name="suche" value={suche} />
        <textarea
          name="text"
          required
          maxLength={20000}
          rows={4}
          placeholder={`Antwort an ${kopf.gegenstelle}`}
          aria-label="Antwort schreiben"
          className={eingabe}
        />
        <div className="flex items-center justify-between gap-3">
          {/* Empfaenger und Betreff stehen hier nur als Text. Sie kommen bei
              mycakeday.ch aus dem Faden, nicht aus diesem Formular. */}
          <span className="truncate text-[11.5px] text-fg-3">
            Re: {kopf.betreff} · an {kopf.gegenstelle}
          </span>
          <Button type="submit" size="sm">
            Senden
          </Button>
        </div>
      </form>
    </div>
  );
}
