// GET /api/cron/consult-week: every Sunday evening a mail to Alain asking when he does consults next week, with one
// button to his cal.com schedules (Alain 2026-11-24: "jede Woche vorauswählen kann wann ich die Consults mache",
// "über das handy", "nicht immer dran denken müssen"). He sets the week on his phone in cal.com; if he does nothing,
// the standard of the two schedules stays (weekdays 9-12 taken at once, 13-17 with his confirmation).
//
// Vercel cron in vercel.json, Sundays 17:00 UTC (18:00 in Zurich in winter, 19:00 in summer). Auth like the other
// crons: `Authorization: Bearer $CRON_SECRET`, fail-closed, compared in constant time. Sent like the inbox digest
// (Resend via the vault, to the notification address in admin settings).

import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { getAdminSettings } from "@/lib/adminSettings";
import { getForProxy } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESEND_SECRET_ID = "3400552d-aed3-43fa-b1de-ff36632c789c"; // vault "Resend API-Key", as in lib/notifFlusher
const AVAILABILITY = "https://cal.getklar.org/availability";

function weekLabel(now: Date): string {
  const monday = new Date(now.getTime() + 86_400_000); // the cron runs on Sunday
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  const f = (d: Date) => new Intl.DateTimeFormat("de-CH", { day: "numeric", month: "long", timeZone: "Europe/Zurich" }).format(d);
  return `${f(monday)} bis ${f(sunday)}`;
}

function consultWeekMail(now: Date): { subject: string; html: string } {
  const week = weekLabel(now);
  const subject = `Consult-Zeiten für die Woche vom ${week}`;
  const html = `<!doctype html><html><body style="margin:0;background:#F4F4EF">
<div style="max-width:520px;margin:0 auto;padding:40px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#141414;text-align:center">
  <p style="font-size:13px;color:#6B6B6B;margin:0 0 12px">Klar Studios · Consults</p>
  <h1 style="font-size:26px;line-height:1.2;margin:0 0 16px">Wann machst du nächste Woche Consults?</h1>
  <p style="font-size:16px;line-height:1.5;margin:0 0 28px">Woche vom ${week}. Tipp in cal.com an, an welchen Tagen und zu welchen Zeiten Leute buchen können.</p>
  <a href="${AVAILABILITY}" style="display:inline-block;background:#141414;color:#fff;text-decoration:none;font-size:16px;font-weight:600;padding:16px 32px;border-radius:999px">Zeiten festlegen</a>
  <p style="font-size:14px;line-height:1.5;color:#4A4A4A;margin:28px 0 0">Zwei Zeitpläne: <b>Consult: sofort angenommen</b> (Buchung steht sofort) und <b>Consult: mit Bestätigung</b> (du bestätigst per Mail). Für einzelne Tage unter "Datumsüberschreibungen" eintragen.</p>
  <p style="font-size:14px;line-height:1.5;color:#4A4A4A;margin:12px 0 0">Machst du nichts, gilt der Standard: werktags 9 bis 12 sofort, 13 bis 17 mit Bestätigung.</p>
</div></body></html>`;
  return { subject, html };
}

export async function GET(req: NextRequest): Promise<Response> {
  const SECRET = process.env.CRON_SECRET ?? "";
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${SECRET}`);
  if (!SECRET || got.length !== want.length || !timingSafeEqual(got, want)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const resend = await getForProxy(RESEND_SECRET_ID);
  if (!resend) return NextResponse.json({ ok: false, error: "resend_key" }, { status: 502 });
  const settings = await getAdminSettings({ revalidate: 0 });
  const { subject, html } = consultWeekMail(new Date());
  const { error } = await new Resend(resend.key).emails.send({
    from: "Klar Postfach <postfach@getklar.org>",
    to: settings.notification_recipient_email,
    subject,
    html,
  });
  if (error) return NextResponse.json({ ok: false, error: String(error.message ?? error) }, { status: 502 });
  return NextResponse.json({ ok: true, to: settings.notification_recipient_email, subject });
}
