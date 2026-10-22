// SERVER ONLY. Confirms creators without them tapping "Check my bio" (Alain 2026-10-22: "die automatische
// Bio-Prüfung über Evomi, im 6-Stunden-Lauf für alle, die auf den Code warten"). Both real sign-ups of the first day
// put the code in their bio and never came back to tap. lib/postViews calls this when our own Apify run comes in,
// before the task inputs are synced, so whoever it confirms is read in the creators' run that follows.
//
// Each account is one Evomi read (verifyCreatorAccount, the same check as the button), about 0.16 USD per 1000.

import { listWaitingAccounts, verifyCreatorAccount } from "./creatorAccounts";
import { sendConfirmedMail } from "./creatorMail";

export async function checkWaitingBios(now = Date.now()): Promise<{ checked: number; confirmed: string[] }> {
  const waiting = await listWaitingAccounts(now);
  const results = await Promise.all(waiting.map(async (a) => ({ a, ok: (await verifyCreatorAccount(a).catch(() => null))?.ok === true })));
  const confirmed = results.filter((r) => r.ok).map((r) => r.a);
  await Promise.all(confirmed.map((a) => sendConfirmedMail(a.email, a.tiktok_handle!, a.bio_code)));
  return { checked: waiting.length, confirmed: confirmed.map((a) => a.tiktok_handle!) };
}
