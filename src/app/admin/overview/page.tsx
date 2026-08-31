// Klar Control · Übersicht. Die Seite, auf der man landet.
//
// Server-Komponente und die Arbeitsliste des Studios: was wartet auf mich, und
// woran bin ich gerade dran. Sie liest dieselben Affiliate- und Outreach-Daten
// wie zuvor, aber nur um "ist da etwas offen" zu beantworten. Das Umsatzbild,
// der Funnel und die Tabelle je App, die frueher darunter standen, waren eine
// Kopie von /admin/revenue und sind seit 2026-08-11 weg. Blankes /admin und
// ?view=overview leiten mit 303 hierher.
//
// 2026-08-25: Die Darstellung ist aus dieser Datei ausgezogen. Vorher wurden
// gut hundertfuenfzig Zeilen HTML als Zeichenketten zusammengeklebt und per
// dangerouslySetInnerHTML in die Seite geschrieben, samt Inline-Stilen und
// SVG-Fragmenten. Jetzt beschafft diese Datei nur noch Daten; gezeichnet wird
// in `Arbeitsliste.tsx`, `Projektliste.tsx` und `AppKacheln.tsx`. Die Zahlen
// selbst, ihre Reihenfolge und ihre Quellen sind unveraendert.
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET (+ die
//      Supabase-Schluessel je App ueber sbGet, und KLAR_INBOX_* fuer den Feed).

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readCookieFromString, eur } from "../_shared";
import { AdminTopbar } from "../AdminTopbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Arbeitsliste, type Aufgabe } from "./Arbeitsliste";
import { Projektliste } from "./Projektliste";
import { AppKacheln } from "./AppKacheln";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps, sbGet, fetchAppUserStats, type AdminApp } from "../../../lib/adminApps";
import { countOpenCollabs } from "@/lib/collabView";
import { countOpenTodos } from "@/lib/todoStore";
import { readActiveProjects, type BrainProject } from "@/lib/brainStatus";
import { listOutreachTargets } from "../../../lib/outreachStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Quelle des Kontaktformulars (anime-vault) fuer den Zaehler "neue Anfragen".
const KLAR_INBOX_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KLAR_INBOX_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

type Uebersicht = {
  aufgaben: Aufgabe[];
  projekte: BrainProject[];
  verdrahtet: Set<string>;
};

async function uebersichtLaden(apps: AdminApp[]): Promise<Uebersicht> {
  const verdrahtet = new Set(apps.map((a) => a.slug));

  // Kein frueher Ausstieg, wenn nichts verdrahtet ist: Arbeitsliste und
  // Projekte kommen gar nicht aus den Affiliate-Backends (Collab-Post,
  // Inbox-Anfragen, AI-Brain). Hier abzubrechen hat frueher beide geleert und
  // eine Seite hinterlassen, die nach Affiliate schmeckte und leer war. Mit
  // apps = [] kommen die app-abgeleiteten Zaehler eben auf null.
  const rows = await Promise.all(
    apps.map(async (app) => {
      // Nur was die Arbeitsliste braucht: offenes Geld, offene Antworten.
      // Die Historie der Umsatzereignisse steht auf /admin/revenue.
      const [inf, claim, outreach] = await Promise.all([
        sbGet(app, "influencers?select=status", { revalidate: 30 }),
        sbGet(app, "influencer_claimable?select=claimable_eur_cents,unnormalized_events", { revalidate: 30 }),
        listOutreachTargets({ platform: "all", status: "all", app: app.slug, limit: 500 }),
      ]);
      const open = claim.reduce((s: number, c: any) => s + Number(c.claimable_eur_cents ?? 0), 0);
      // Zaehler je App im Funnel, damit die Startseite auf einen Blick zeigt,
      // wie viele Creator je App mittendrin stecken.
      let angefragt = 0;
      let reply = 0;
      for (const t of outreach) {
        if (t.status === "replied") reply++;
        else if (t.mail_status === "mail1_sent" || t.mail_status === "mail2_sent" || t.status === "dm_sent")
          angefragt++;
      }
      return { open, angefragt, reply };
    }),
  );

  // Inbox-Anfragen: nur die Anzahl der neuen. Best-effort, ohne Schluessel
  // oder bei einem Fehler bleibt der Zaehler null und die Zeile faellt weg.
  let inquiriesNew = 0;
  if (KLAR_INBOX_KEY) {
    try {
      const res = await fetch(
        `${KLAR_INBOX_URL}/rest/v1/klar_inquiries?select=status&order=created_at.desc&limit=50`,
        {
          headers: { apikey: KLAR_INBOX_KEY, Authorization: `Bearer ${KLAR_INBOX_KEY}`, Accept: "application/json" },
          next: { revalidate: 30 },
        },
      );
      if (res.ok) {
        const j = await res.json();
        inquiriesNew = Array.isArray(j) ? j.filter((r) => r.status === "new").length : 0;
      }
    } catch {
      /* Zaehler bleibt null */
    }
  }

  // Signale, die die Arbeitsliste braucht: wer wartet auf eine Antwort, welche
  // App ist still geworden, und woran arbeite ich laut AI-Brain gerade.
  const [collabOpen, todoOpen, appStats, projekte] = await Promise.all([
    countOpenCollabs(),
    countOpenTodos(),
    Promise.all(apps.map(async (a) => ({ app: a, stats: await fetchAppUserStats(a) }))),
    readActiveProjects(6),
  ]);
  // "Still" = Backend antwortet, hat Nutzer, aber seit 30 Tagen keinen neuen.
  const silentApps = appStats
    .filter((a) => a.stats !== null && a.stats.usersTotal > 0 && a.stats.usersNew30d === 0)
    .map((a) => a.app.name);

  const totalOpen = rows.reduce((s, r) => s + r.open, 0);
  const totalAngefragt = rows.reduce((s, r) => s + r.angefragt, 0);
  const totalReply = rows.reduce((s, r) => s + r.reply, 0);

  // Die Reihenfolge ist die Aussage: zuerst wer auf MICH wartet, dann Geld,
  // dann was still geworden ist, zuletzt was auf ANDERE wartet.
  const aufgaben: Aufgabe[] = [
    {
      n: collabOpen,
      titel: "Collab-Anfragen beantworten",
      meta: "Jemand hat an eine Bio-Adresse geschrieben und wartet",
      href: "/admin/collabs",
      symbol: "inbox",
      ton: "var(--warning)",
    },
    {
      n: todoOpen,
      titel: "Eigene To-dos offen",
      meta: "Deine Liste, nicht aus Daten abgeleitet",
      href: "/admin/todos",
      symbol: "check",
      ton: "var(--fg-2)",
    },
    {
      n: inquiriesNew,
      titel: "Neue Anfragen in der Inbox",
      meta: "Bewerbungen und Consulting-Anfragen von der Website",
      href: "/admin/inbox",
      symbol: "doc",
      ton: "var(--info)",
    },
    {
      n: totalReply,
      titel: "Outreach-Antworten offen",
      meta: "Angeschriebene Creator haben geantwortet",
      href: "/admin/outreach",
      symbol: "reply",
      ton: "var(--warning)",
    },
    {
      n: rows.filter((r) => r.open > 0).length,
      titel: "Auszahlungen fällig",
      meta: `${eur(totalOpen)} netto und gereift`,
      href: "/admin/payouts",
      symbol: "coin",
      ton: "var(--fg)",
    },
    {
      n: silentApps.length,
      titel: "Apps ohne neue User (30 Tage)",
      meta: silentApps.join(", "),
      href: "/admin/analytics",
      symbol: "pulse",
      ton: "var(--fg-3)",
    },
    {
      n: totalAngefragt,
      titel: "Wartet auf Antwort",
      meta: "Rausgeschickt, Ball liegt bei den anderen",
      href: "/admin/outreach",
      symbol: "send",
      ton: "var(--fg-4)",
    },
  ];

  return { aufgaben, projekte, verdrahtet };
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  // Schranke wie bei brain/cal/bookings/revenue (Geraete-Cookie + Sitzung).
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) redirect("/admin/login");
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const device = await verifyDeviceCookie(readCookieFromString(cookieHeader, "klar_device"), DEV);
  if (!device) redirect("/admin/login");
  if (readCookieFromString(cookieHeader, "klar_admin") !== KEY) redirect("/admin/login");

  const sp = await searchParams;
  const apps = getApps();
  const { aufgaben, projekte, verdrahtet } = await uebersichtLaden(apps);

  return (
    <>
      <title>Übersicht · Klar Control</title>
      <AdminTopbar titel="Übersicht" />
      <div className="content">
        {sp.msg ? <div className="flash">{sp.msg}</div> : null}

        <h1>Übersicht</h1>
        <Card className="mb-4 gap-0 p-0">
          <CardHeader className="px-6 pb-3 pt-5">
            <CardTitle>Was liegt an</CardTitle>
          </CardHeader>
          <Arbeitsliste aufgaben={aufgaben} />
        </Card>

        {projekte.length ? (
          <Card className="mb-5 gap-0 p-0">
            <CardHeader className="flex-row items-baseline justify-between px-6 pb-3 pt-5">
              <CardTitle>Woran ich gerade arbeite</CardTitle>
              <a href="/admin/brain" className="applink text-[11.5px]">
                AI-Brain öffnen →
              </a>
            </CardHeader>
            <Projektliste projekte={projekte} />
          </Card>
        ) : null}

        <AppKacheln verdrahtet={verdrahtet} />
      </div>
    </>
  );
}
