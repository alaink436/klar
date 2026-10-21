// SERVER ONLY. The weekly report to Alain on Mondays (spec Projects/Klar/specs/
// creator-plattform, ticket 05): the estimate, views per post for each format at
// the creators and at us, tired formats, and what the creators earned so far
// this month. Sent from the creator-model cron.

import "server-only";
import { Resend } from "resend";
import { getAdminSettings } from "./adminSettings";
import { latestModelRun, monthEarnings, usd, type Earning, type ModelRun } from "./creatorEarnings";
import { formatStats, type FormatStats } from "./formatStats";
import { getForProxy } from "./vault";

const RESEND_SECRET_ID = "3400552d-aed3-43fa-b1de-ff36632c789c"; // as lib/notifFlusher

const num = (n: number | null, digits = 0) => (n === null ? "-" : n.toLocaleString("de-CH", { maximumFractionDigits: digits, minimumFractionDigits: digits }));

export function buildWeeklyReport(run: ModelRun, stats: FormatStats, earnings: Array<Earning & { handle: string }>): { subject: string; text: string } {
  const source = run.rate_source === "fit" ? `gelernt aus ${run.days_of_data} Tagen` : `Prototyp, erst ${run.days_of_data} Tage View-Stände`;
  const extra = run.actual_signups - run.baseline_signups;
  const lines = [
    `Rechenmodell (${run.run_date})`,
    `- Rate ${num(run.rate_per_1000, 2)} Anmeldungen pro 1000 Views (${source})`,
    `- Monat bisher: ${run.actual_signups} Anmeldungen, Grundlinie ${num(run.baseline_signups, 1)}, also ${num(extra, 1)} durch Posts`,
    `- Umsatz pro Anmeldung ${usd(run.revenue_per_signup_cents)}, Mehrumsatz ${usd(run.extra_revenue_cents)}, Deckel ${usd(run.cap_cents)}`,
    `- Deckel greift: ${run.cap_factor < 1 ? `ja, alle auf ${num(run.cap_factor * 100)} % gekürzt` : "nein"}`,
    "",
    "Formate, Views nach 3 Tagen je Post bei den Creatorn",
    ...stats.formats.map((f) => `- ${f.formatId}: ${num(f.viewsPerPost)} (${f.posts} Posts)${f.tired ? ", müde" : ""}`),
    `- Unsere Konten, Posts der letzten Woche: ${num(stats.own.viewsPerPost)} (${stats.own.posts} Posts)`,
    "",
    `Creator mit gezählten Posts im Monat: ${earnings.length}`,
    ...earnings.slice(0, 10).map((e) => `- @${e.handle}: ${num(e.views)} Views, ${num(e.est_signups, 1)} Anmeldungen, ${usd(e.payable_cents)}`),
  ];
  const tired = stats.formats.filter((f) => f.tired).length;
  return {
    subject: `Creator-Plattform: Woche bis ${run.run_date}${tired ? `, ${tired} müde Formate` : ""}`,
    text: `${lines.join("\n")}\n\nKlar Control: https://getklar.org/admin/modell`,
  };
}

export async function sendWeeklyReport(): Promise<boolean> {
  const run = await latestModelRun();
  if (!run) return false;
  const [stats, earnings, settings, resend] = await Promise.all([
    formatStats(),
    monthEarnings(run.month),
    getAdminSettings(),
    getForProxy(RESEND_SECRET_ID),
  ]);
  if (!resend) return false;
  const { subject, text } = buildWeeklyReport(run, stats, earnings);
  try {
    const { error } = await new Resend(resend.key).emails.send({
      from: "Klar Studios <postfach@getklar.org>",
      to: settings.notification_recipient_email,
      subject,
      text,
    });
    return !error;
  } catch (e) {
    console.warn("[creatorReport] mail", e);
    return false;
  }
}
