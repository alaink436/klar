// Yarn-Stash revenuecat-webhook (S30: unified auth).
// Deployed to zysmsgaordfkptzngntn at 2026-05-22.
//
// Receives RC subscription events and mirrors the entitlement to
// public.user_entitlements (server-side source of truth for premium gating).
//
// Auth: shared secret in the Authorization header. Reads RC_WEBHOOK_SECRET
// (primary, matches the Klar affiliate-ingest convention) with
// REVENUECAT_WEBHOOK_SECRET as a backward-compatible fallback.
// Bearer-prefix is tolerated. Fail-closed if no secret is set.
//
// Configure in RC Dashboard → Integrations → Webhooks:
//   URL: https://zysmsgaordfkptzngntn.supabase.co/functions/v1/revenuecat-webhook
//   Authorization: <secret value>  (no Bearer prefix needed)

// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GRANT_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
]);
const REVOKE_EVENTS = new Set([
  "EXPIRATION",
  "SUBSCRIPTION_PAUSED",
]);

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const j = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return j(405, { error: "method_not_allowed" });

  // Auth: dual-secret-name, Bearer-prefix tolerated.
  const secret = Deno.env.get("RC_WEBHOOK_SECRET") || Deno.env.get("REVENUECAT_WEBHOOK_SECRET") || "";
  if (!secret) return j(500, { error: "server_misconfigured_no_secret" });
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!timingSafeEqual(provided, secret)) return j(401, { error: "unauthorized" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return j(500, { error: "function_misconfigured" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return j(400, { error: "invalid_json" });
  }

  const event = body?.event;
  if (!event?.type) return j(400, { error: "missing_event" });

  const type = String(event.type);
  if (type === "TEST") return j(200, { ok: true, test: true });

  const appUserId = event.app_user_id;
  const expirationAtMs = event.expiration_at_ms;
  if (!appUserId) return j(400, { error: "missing_app_user_id" });

  let isPremium: boolean | null = null;
  if (GRANT_EVENTS.has(type)) isPremium = true;
  else if (REVOKE_EVENTS.has(type)) isPremium = false;
  if (isPremium === null) return j(200, { ok: true, action: "ignored", eventType: type });

  const expiresAt = expirationAtMs ? new Date(expirationAtMs).toISOString() : null;
  const client = createClient(supabaseUrl, serviceRoleKey);

  const { error } = await client.from("user_entitlements").upsert(
    {
      user_id: appUserId,
      is_premium: isPremium,
      source: "revenuecat",
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return j(500, { error: "db_update_failed", detail: error.message });

  return j(200, { ok: true, action: isPremium ? "granted" : "revoked", userId: appUserId, eventType: type });
});
