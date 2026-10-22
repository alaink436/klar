// SERVER ONLY. The monthly payout of what creators earned (migrations/0049,
// spec Projects/Klar/specs/creator-plattform, ticket 06).
//
//   owed       payable_cents of his closed months (klar_creator_earnings, after
//              the cap; rejected posts are never in it, posts that counted stay
//              in it after a pause or closing) minus every payout not failed
//   from $25   he enters his Wise details, the amount shows on Klar Control's
//              payout list; below it carries over into the next month
//   approve    Alain, per creator: recipient (once), quote, transfer in Wise.
//              Wise lets a personal token create transfers in Europe but not
//              fund them, so Alain funds each one in the Wise app.
//
// The Wise token is a Klar-Vault entry with base_url https://api.wise.com.

import "server-only";
import { getForProxy, listSecrets } from "./vault";

const HUB = process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const HUB_KEY = () => process.env.KLAR_INBOX_SERVICE_KEY ?? "";

export const MIN_PAYOUT_CENTS = 2500;
/** Alain's Wise balance; the creator receives USD, the currency the estimate is in. */
const SOURCE_CURRENCY = "CHF";
/** Test accounts land in no number and no payout (spec). */
const TEST_HANDLE = /^klar_test/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PayoutWrite = { ok: true; msg: string } | { ok: false; msg: string };

export interface Balance {
  creatorId: string;
  handle: string;
  earnedCents: number;
  paidCents: number;
  owedCents: number;
  throughMonth: string | null;
  wiseEmail: string | null;
  wiseName: string | null;
}

export interface Payout {
  id: string;
  creator_id: string | null;
  handle: string;
  amount_cents: number;
  through_month: string;
  status: "sending" | "sent" | "failed";
  wise_transfer_id: number | null;
  error: string | null;
  created_at: string;
}

interface Account {
  id: string;
  tiktok_handle: string;
  wise_email: string | null;
  wise_name: string | null;
  wise_recipient_id: number | null;
}

function headers(extra?: HeadersInit): HeadersInit {
  return { apikey: HUB_KEY(), Authorization: `Bearer ${HUB_KEY()}`, "Content-Type": "application/json", ...extra };
}

async function hubGet<T>(path: string): Promise<T[]> {
  const res = await fetch(`${HUB}/rest/v1/${path}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`hub ${res.status} ${path.split("?")[0]}`);
  return (await res.json()) as T[];
}

async function hubPatch(path: string, body: unknown): Promise<boolean> {
  const res = await fetch(`${HUB}/rest/v1/${path}`, { method: "PATCH", headers: headers({ Prefer: "return=minimal" }), body: JSON.stringify(body) });
  return res.ok;
}

const monthStart = (now: number) => {
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
};

/** What each creator earned in closed months and was paid, from the raw rows. */
export function owed(
  earnings: Array<{ creator_id: string; month: string; payable_cents: number }>,
  payouts: Array<{ creator_id: string | null; amount_cents: number; status: string }>,
  currentMonth: string,
): Map<string, { earned: number; paid: number; through: string | null }> {
  const out = new Map<string, { earned: number; paid: number; through: string | null }>();
  const row = (id: string) => out.get(id) ?? out.set(id, { earned: 0, paid: 0, through: null }).get(id)!;
  for (const e of earnings) {
    if (e.month >= currentMonth) continue;
    const r = row(e.creator_id);
    r.earned += e.payable_cents;
    if (!r.through || e.month > r.through) r.through = e.month;
  }
  for (const p of payouts) if (p.creator_id && p.status !== "failed") row(p.creator_id).paid += p.amount_cents;
  return out;
}

/** Every creator who earned something, largest amount owed first. */
export async function balances(creatorId?: string, now = Date.now()): Promise<Balance[]> {
  const only = creatorId ? `&creator_id=eq.${creatorId}` : "";
  const [earnings, payouts] = await Promise.all([
    hubGet<{ creator_id: string; month: string; payable_cents: number }>(`klar_creator_earnings?select=creator_id,month,payable_cents${only}`),
    hubGet<{ creator_id: string | null; amount_cents: number; status: string }>(`klar_payouts?select=creator_id,amount_cents,status${only}`),
  ]);
  const sums = owed(earnings, payouts, monthStart(now));
  if (sums.size === 0) return [];
  const accounts = await hubGet<Account>(`klar_creator_accounts?id=in.(${[...sums.keys()].join(",")})&select=id,tiktok_handle,wise_email,wise_name,wise_recipient_id`);
  return accounts
    .filter((a) => !TEST_HANDLE.test(a.tiktok_handle))
    .map((a) => {
      const s = sums.get(a.id)!;
      return {
        creatorId: a.id,
        handle: a.tiktok_handle,
        earnedCents: s.earned,
        paidCents: s.paid,
        owedCents: s.earned - s.paid,
        throughMonth: s.through,
        wiseEmail: a.wise_email,
        wiseName: a.wise_name,
      };
    })
    .sort((a, b) => b.owedCents - a.owedCents);
}

export async function listPayouts(creatorId?: string): Promise<Payout[]> {
  return hubGet<Payout>(`klar_payouts?select=*&order=created_at.desc${creatorId ? `&creator_id=eq.${creatorId}` : "&limit=50"}`);
}

/** The creator's Wise details; a change drops the recipient Wise knows, so the next payout creates a new one. With
    `acceptTerms` (the first payout's form) it also notes when he accepted the creator terms. */
export async function saveWiseDetails(accountId: string, email: string, name: string, acceptTerms = false): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const n = name.trim().replace(/\s+/g, " ");
  if (!EMAIL_RE.test(e) || n.length < 2 || n.length > 80) return false;
  return hubPatch(`klar_creator_accounts?id=eq.${accountId}`, {
    wise_email: e,
    wise_name: n,
    wise_recipient_id: null,
    ...(acceptTerms && { terms_accepted_at: new Date().toISOString() }),
  });
}

type Wise = (path: string, body?: unknown) => Promise<Record<string, unknown> & { id?: number | string }>;

async function wiseClient(): Promise<Wise | null> {
  const entry = (await listSecrets()).find((s) => !s.revoked_at && (s.base_url ?? "").includes("api.wise.com"));
  const conn = entry ? await getForProxy(entry.id) : null;
  if (!conn) return null;
  return async (path, body) => {
    const res = await fetch(`${conn.baseUrl.replace(/\/$/, "")}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${conn.key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Wise ${res.status} ${path}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : {};
  };
}

/** Alain's approval of one creator's payout: everything he is owed, as a Wise transfer to fund in the Wise app. */
export async function approvePayout(creatorId: string, now = Date.now()): Promise<PayoutWrite> {
  const [b] = await balances(creatorId, now);
  if (!b) return { ok: false, msg: "Für diesen Creator ist nichts offen." };
  const usd = `$${(b.owedCents / 100).toFixed(2)}`;
  if (b.owedCents < MIN_PAYOUT_CENTS) return { ok: false, msg: `@${b.handle}: ${usd} liegt unter 25 USD, das rollt in den nächsten Monat.` };
  if (!b.wiseEmail || !b.wiseName) return { ok: false, msg: `@${b.handle} hat noch keine Wise-Daten angegeben.` };
  const wise = await wiseClient();
  if (!wise) return { ok: false, msg: "Kein Wise-Schlüssel im Klar-Vault (Eintrag mit base_url https://api.wise.com)." };

  const ins = await fetch(`${HUB}/rest/v1/klar_payouts`, {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({ creator_id: b.creatorId, handle: b.handle, amount_cents: b.owedCents, through_month: b.throughMonth }),
  });
  if (!ins.ok) return { ok: false, msg: `Nicht gespeichert (${ins.status}).` };
  const [payout] = (await ins.json()) as Payout[];

  try {
    const profiles = (await wise("/v2/profiles")) as unknown as Array<{ id: number; type: string }>;
    const profile = profiles.find((p) => p.type.toLowerCase() === "business")?.id;
    if (!profile) throw new Error("kein Business-Profil in Wise");
    const [account] = await hubGet<Account>(`klar_creator_accounts?id=eq.${b.creatorId}&select=id,tiktok_handle,wise_email,wise_name,wise_recipient_id`);
    let recipient = account?.wise_recipient_id ?? null;
    if (!recipient) {
      const created = await wise("/v1/accounts", { profile, accountHolderName: b.wiseName, currency: "USD", type: "email", details: { email: b.wiseEmail } });
      recipient = Number(created.id);
      await hubPatch(`klar_creator_accounts?id=eq.${b.creatorId}`, { wise_recipient_id: recipient });
    }
    const quote = await wise(`/v3/profiles/${profile}/quotes`, {
      sourceCurrency: SOURCE_CURRENCY,
      targetCurrency: "USD",
      targetAmount: b.owedCents / 100,
      targetAccount: recipient,
    });
    const transfer = await wise("/v1/transfers", {
      targetAccount: recipient,
      quoteUuid: quote.id,
      customerTransactionId: payout.id,
      details: { reference: "Klar Studios" },
    });
    await hubPatch(`klar_payouts?id=eq.${payout.id}`, { status: "sent", wise_transfer_id: Number(transfer.id) });
    return { ok: true, msg: `@${b.handle}: ${usd} als Überweisung in Wise angelegt. Jetzt in der Wise-App bezahlen.` };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await hubPatch(`klar_payouts?id=eq.${payout.id}`, { status: "failed", error: error.slice(0, 500) });
    return { ok: false, msg: `@${b.handle}: Wise hat abgelehnt. ${error.slice(0, 200)}` };
  }
}
