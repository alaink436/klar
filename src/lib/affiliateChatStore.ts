// SERVER ONLY. In-app affiliate <-> Alain chat (klar_affiliate_messages on
// anime-vault). direction 'in' = from the affiliate, 'out' = from Alain.
// Used by the dashboard chat API (scoped to the session user) and the admin
// inbox (reads all threads, writes 'out' replies). Migration:
// klar_affiliate_messages_v1 (2026-06-07).

import { serviceSupabase } from "@/lib/supabaseAuth";

export type ChatDirection = "in" | "out";

export interface AffiliateMessage {
  id: string;
  affiliate_user_id: string;
  direction: ChatDirection;
  body: string;
  created_at: string;
  read_at: string | null;
}

/** Full thread for one affiliate, oldest first. */
export async function listAffiliateMessages(
  affiliateUserId: string,
  limit = 300,
): Promise<AffiliateMessage[]> {
  const svc = serviceSupabase();
  const { data } = await svc
    .from("klar_affiliate_messages")
    .select("*")
    .eq("affiliate_user_id", affiliateUserId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data as AffiliateMessage[] | null) ?? [];
}

/** Append one message. Returns the stored row, or null on failure. */
export async function insertAffiliateMessage(
  affiliateUserId: string,
  direction: ChatDirection,
  body: string,
): Promise<AffiliateMessage | null> {
  const svc = serviceSupabase();
  const { data, error } = await svc
    .from("klar_affiliate_messages")
    .insert({ affiliate_user_id: affiliateUserId, direction, body })
    .select("*")
    .single();
  if (error) return null;
  return data as AffiliateMessage;
}

export interface AffiliateChatThread {
  affiliate_user_id: string;
  display_name: string | null;
  email: string | null;
  apps: string[];
  messages: AffiliateMessage[];
  unread_in: number; // unread messages from the affiliate (admin's view)
}

/** Every affiliate chat thread (one per affiliate that has messages), newest
 *  activity first, each with its full message list. Joins klar_affiliates for
 *  the display name / email / apps. Powers the admin inbox. */
export async function loadAffiliateChatInbox(): Promise<AffiliateChatThread[]> {
  const svc = serviceSupabase();
  const { data: msgs } = await svc
    .from("klar_affiliate_messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(5000);
  const rows = (msgs as AffiliateMessage[] | null) ?? [];
  if (rows.length === 0) return [];

  const byUser = new Map<string, AffiliateMessage[]>();
  for (const r of rows) {
    const arr = byUser.get(r.affiliate_user_id) ?? [];
    arr.push(r);
    byUser.set(r.affiliate_user_id, arr);
  }

  const ids = [...byUser.keys()];
  const { data: affs } = await svc
    .from("klar_affiliates")
    .select("user_id, display_name, email, apps")
    .in("user_id", ids);
  const metaById = new Map<string, { display_name: string | null; email: string | null; apps: string[] }>();
  for (const a of (affs as Array<{ user_id: string; display_name: string | null; email: string | null; apps: string[] }> | null) ?? []) {
    metaById.set(a.user_id, { display_name: a.display_name, email: a.email, apps: a.apps ?? [] });
  }

  const threads: AffiliateChatThread[] = ids.map((uid) => {
    const messages = byUser.get(uid)!;
    const meta = metaById.get(uid);
    return {
      affiliate_user_id: uid,
      display_name: meta?.display_name ?? null,
      email: meta?.email ?? null,
      apps: meta?.apps ?? [],
      messages,
      unread_in: messages.filter((m) => m.direction === "in" && !m.read_at).length,
    };
  });
  threads.sort((a, b) => {
    const al = a.messages[a.messages.length - 1]?.created_at ?? "";
    const bl = b.messages[b.messages.length - 1]?.created_at ?? "";
    return bl.localeCompare(al);
  });
  return threads;
}

/** Mark the affiliate's inbound messages as read (admin opened the thread). */
export async function markAffiliateThreadReadByAdmin(affiliateUserId: string): Promise<void> {
  const svc = serviceSupabase();
  await svc
    .from("klar_affiliate_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("affiliate_user_id", affiliateUserId)
    .eq("direction", "in")
    .is("read_at", null);
}
