// Edge Function: wise-reconcile
//
// Deploy as supabase/functions/wise-reconcile/index.ts in each app's
// Supabase. Called from Klar /admin (POST /admin/reconcile) with header
// `x-admin-key`. Polls Wise for the current status of every item in
// status="dispatched", maps it back to one of paid / failed / processing,
// and flips the batch when all items terminal.
//
// Wise statuses: incoming_payment_waiting / incoming_payment_initiated /
// processing / funds_converted / outgoing_payment_sent / cancelled /
// funds_refunded / bounced_back / charged_back / unknown
//
// Required env: same as wise-dispatch.

// @ts-expect-error Deno runtime
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-expect-error Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WISE_TOKEN = Deno.env.get("WISE_API_TOKEN") ?? "";
const ADMIN_KEY = Deno.env.get("KLAR_APP_ADMIN_KEY") ?? "";
const WISE_BASE = "https://api.wise.com";

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const TERMINAL_PAID = new Set([
  "outgoing_payment_sent",
  "funds_refunded", // money returned to source = user got it then refunded? Treat as paid for our books, refund handled by clawback logic.
]);
const TERMINAL_FAILED = new Set([
  "cancelled",
  "bounced_back",
  "charged_back",
]);

async function wiseGet(path: string): Promise<Response> {
  return await fetch(`${WISE_BASE}${path}`, {
    headers: { Authorization: `Bearer ${WISE_TOKEN}` },
  });
}

serve(async (req: Request) => {
  if (req.method !== "POST") return j({ error: "method_not_allowed" }, 405);
  if (req.headers.get("x-admin-key") !== ADMIN_KEY) {
    return j({ error: "unauthorized" }, 401);
  }
  if (!WISE_TOKEN) return j({ error: "wise_misconfigured" }, 500);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: items, error } = await sb
    .from("influencer_payout_items")
    .select("id, batch_id, provider_ref, status")
    .in("status", ["dispatched", "processing"]);
  if (error) return j({ error: "items_query_failed", detail: error.message }, 500);
  if (!items || items.length === 0) return j({ checked: 0, paid: 0, failed: 0 });

  let paid = 0;
  let failed = 0;
  const touchedBatches = new Set<string>();

  for (const it of items) {
    if (!it.provider_ref) continue;
    try {
      const r = await wiseGet(`/v1/transfers/${it.provider_ref}`);
      if (!r.ok) continue;
      const t: any = await r.json();
      const status = String(t?.status ?? "");
      const next =
        TERMINAL_PAID.has(status) ? "paid"
        : TERMINAL_FAILED.has(status) ? "failed"
        : "processing";
      const patch: Record<string, unknown> = { status: next };
      if (next === "paid") patch["paid_at"] = new Date().toISOString();
      if (next === "failed") patch["provider_error"] = `wise:${status}`;
      await sb.from("influencer_payout_items").update(patch).eq("id", it.id);
      if (next === "paid") paid++;
      if (next === "failed") failed++;
      touchedBatches.add(String(it.batch_id));
    } catch {
      // skip transient errors
    }
  }

  // Flip batch headers when all their items are terminal.
  for (const bid of touchedBatches) {
    const { data: rest } = await sb
      .from("influencer_payout_items")
      .select("status")
      .eq("batch_id", bid);
    if (!rest) continue;
    const stillOpen = rest.some((r: any) => r.status === "dispatched" || r.status === "processing" || r.status === "queued");
    if (stillOpen) continue;
    const anyFailed = rest.some((r: any) => r.status === "failed");
    await sb.from("influencer_payout_batches")
      .update({
        status: anyFailed ? "failed" : "paid",
        paid_at: anyFailed ? null : new Date().toISOString(),
      })
      .eq("id", bid);
  }

  return j({ checked: items.length, paid, failed });
});
