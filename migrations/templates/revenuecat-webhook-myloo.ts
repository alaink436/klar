// MyLoo revenuecat-webhook (S30: unified auth).
// Deployed to jkgymggxshtsljjvketi at 2026-05-22.
//
// Receives RC subscription events and inserts conversion rows into
// public.conversions (MyLoo's existing convention).
//
// Auth: matches against EITHER RC_WEBHOOK_SECRET OR REVENUECAT_WEBHOOK_SECRET.
// Either one being correct is enough. Bearer-prefix tolerated. Fail-closed
// if NEITHER secret is configured. (Hardcoded fallback removed in S30.)

// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function matchesEitherSecret(provided: string): boolean {
  const primary = Deno.env.get("RC_WEBHOOK_SECRET") ?? "";
  const fallback = Deno.env.get("REVENUECAT_WEBHOOK_SECRET") ?? "";
  if (!primary && !fallback) return false;
  const matchesPrimary = primary !== "" && timingSafeEqual(provided, primary);
  const matchesFallback = fallback !== "" && timingSafeEqual(provided, fallback);
  return matchesPrimary || matchesFallback;
}

function hasAnySecret(): boolean {
  return Boolean(Deno.env.get("RC_WEBHOOK_SECRET") || Deno.env.get("REVENUECAT_WEBHOOK_SECRET"));
}

const j = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return j(405, { error: "method_not_allowed" });

  if (!hasAnySecret()) return j(500, { error: "server_misconfigured_no_secret" });
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!matchesEitherSecret(provided)) return j(401, { error: "unauthorized" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return j(500, { error: "function_misconfigured" });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return j(400, { error: "invalid_json" });
  }

  const ev = payload?.event;
  if (!ev?.type || !ev.app_user_id) return j(400, { error: "invalid_payload" });

  const type = String(ev.type);
  if (type === "TEST") return j(200, { ok: true, test: true });

  if (String(ev.app_user_id).startsWith("$RCAnonymousID:")) {
    return j(200, { skipped: "anonymous_user" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: userLookup, error: userLookupError } = await admin.auth.admin.getUserById(ev.app_user_id);
  if (userLookupError || !userLookup?.user) {
    return j(200, { skipped: "unknown_user", user_id: ev.app_user_id });
  }

  const rawPrice =
    typeof ev.price_in_purchased_currency === "number"
      ? ev.price_in_purchased_currency
      : typeof ev.price === "number"
      ? ev.price
      : null;
  const amountCents = rawPrice !== null ? Math.round(rawPrice * 100) : null;
  const eventAt = ev.event_timestamp_ms ?? ev.purchased_at_ms ?? Date.now();

  const { error: insertError } = await admin.from("conversions").insert({
    user_id: ev.app_user_id,
    event_type: ev.type,
    product_id: ev.product_id ?? null,
    store: ev.store ?? null,
    amount_cents: amountCents,
    currency: ev.currency ?? null,
    transaction_id: ev.transaction_id ?? ev.original_transaction_id ?? null,
    event_at: new Date(eventAt).toISOString(),
  });
  if (insertError && (insertError as { code?: string }).code !== "23505") {
    return j(500, { error: "insert_failed", details: insertError.message });
  }

  return j(200, { ok: true, event_type: ev.type });
});
