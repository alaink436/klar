// Kelva revenuecat-webhook (S30: unified auth).
// Deployed to absnjkjxbxeyekmcmpof at 2026-05-22.
//
// Receives RC subscription events and upserts profiles.is_premium
// (server-side source of truth for AI gating via inbound-email and
// scan-document, which read is_premium server-side and can't be spoofed
// by a client editing its own profile row).
//
// Auth: shared secret in the Authorization header. Reads RC_WEBHOOK_SECRET
// (primary) with REVENUECAT_WEBHOOK_SECRET as fallback. Bearer-prefix tolerated.
// Fail-closed if no secret is set.
//
// app_user_id == the Supabase auth user id, because the app calls
// Purchases.logIn(userId) with exactly that id.

// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ENTITLEMENT_ID = "premium";

const GRANT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
  "TEMPORARY_ENTITLEMENT_GRANT",
]);
// NOTE: CANCELLATION only means auto-renew was turned off; access continues
// until EXPIRATION, so it is deliberately NOT treated as a revoke.
const REVOKE_TYPES = new Set(["EXPIRATION", "SUBSCRIPTION_PAUSED"]);

function isUuid(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function setPremium(supabase: any, userId: string, isPremium: boolean) {
  const { error } = await supabase.from("profiles").upsert(
    { id: userId, is_premium: isPremium, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) console.error(`set is_premium=${isPremium} for ${userId}:`, error.message);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secret = Deno.env.get("RC_WEBHOOK_SECRET") || Deno.env.get("REVENUECAT_WEBHOOK_SECRET") || "";
  if (!secret) {
    console.error("RC_WEBHOOK_SECRET / REVENUECAT_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!timingSafeEqual(provided, secret)) return new Response("Unauthorized", { status: 401 });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const event = payload?.event;
  if (!event?.type) {
    return new Response(JSON.stringify({ message: "No event" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const type: string = String(event.type);
  if (type === "TEST") {
    return new Response(JSON.stringify({ ok: true, test: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const entIds: string[] | undefined = event.entitlement_ids ??
    (event.entitlement_id ? [event.entitlement_id] : undefined);
  if (Array.isArray(entIds) && entIds.length > 0 && !entIds.includes(ENTITLEMENT_ID)) {
    return new Response(JSON.stringify({ message: `Ignored: entitlement ${entIds.join(",")}` }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (type === "TRANSFER") {
    const from: string[] = Array.isArray(event.transferred_from) ? event.transferred_from : [];
    const to: string[] = Array.isArray(event.transferred_to) ? event.transferred_to : [];
    for (const id of from) if (isUuid(id)) await setPremium(supabase, id, false);
    for (const id of to) if (isUuid(id)) await setPremium(supabase, id, true);
    return new Response(JSON.stringify({ message: "Transfer handled" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = event.app_user_id;
  if (!isUuid(userId)) {
    return new Response(JSON.stringify({ message: "No mappable app_user_id" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (GRANT_TYPES.has(type)) {
    await setPremium(supabase, userId, true);
  } else if (REVOKE_TYPES.has(type)) {
    await setPremium(supabase, userId, false);
  }

  return new Response(JSON.stringify({ message: "OK", type }), {
    headers: { "Content-Type": "application/json" },
  });
});
