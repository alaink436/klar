// Edge Function: wise-dispatch
//
// Deploy this into each app's Supabase project as
//   supabase/functions/wise-dispatch/index.ts
//
// Called from Klar /admin (POST /admin/dispatch and /admin/dispatch-all)
// with header `x-admin-key` matching the per-app admin key, plus a JSON
// body `{ "batch_id": <id> }`. The function:
//   1. Loads the batch + every item in status="queued"
//   2. For each item, looks up the influencer's wise_recipient_id
//   3. Creates a Wise quote + transfer (sourceCurrency = EUR fixed)
//   4. Updates the item to status="dispatched" with provider_ref = transfer id
//   5. Flips the batch status to "dispatched" (or "failed" if everything fell over)
//
// Wise transfers are NOT funded automatically. The studio funds the batch
// in the Wise dashboard manually (KYC + balance reasons). Reconciliation
// polls the transfer status and flips items to "paid" once Wise confirms.
//
// Required env (set per project via `supabase secrets set`):
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (auto-injected by Supabase)
//   - WISE_API_TOKEN          (Wise Business personal token)
//   - WISE_PROFILE_ID         (Business profile id, integer)
//   - WISE_SOURCE_CURRENCY    (default "EUR")
//   - KLAR_APP_ADMIN_KEY      (must match the adminKey in KLAR_ADMIN_APPS)
//
// Wise API docs: https://docs.wise.com/api-docs/api-reference

// @ts-expect-error Deno runtime import; resolved at edge-function deploy time
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-expect-error Deno runtime import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WISE_TOKEN = Deno.env.get("WISE_API_TOKEN") ?? "";
const WISE_PROFILE = Deno.env.get("WISE_PROFILE_ID") ?? "";
const WISE_SOURCE_CCY = Deno.env.get("WISE_SOURCE_CURRENCY") ?? "EUR";
const ADMIN_KEY = Deno.env.get("KLAR_APP_ADMIN_KEY") ?? "";
const WISE_BASE = "https://api.wise.com";

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function wisePost(path: string, body: unknown): Promise<Response> {
  return await fetch(`${WISE_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WISE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

serve(async (req: Request) => {
  if (req.method !== "POST") return j({ error: "method_not_allowed" }, 405);
  if (req.headers.get("x-admin-key") !== ADMIN_KEY) {
    return j({ error: "unauthorized" }, 401);
  }
  if (!WISE_TOKEN || !WISE_PROFILE) {
    return j({ error: "wise_misconfigured" }, 500);
  }

  let batchId: string | number | null = null;
  try {
    const body = await req.json();
    batchId = body?.batch_id ?? null;
  } catch {
    return j({ error: "bad_json" }, 400);
  }
  if (batchId == null) return j({ error: "missing_batch_id" }, 400);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: items, error: itemsErr } = await sb
    .from("influencer_payout_items")
    .select("id, influencer_id, influencer_handle, amount_cents, status")
    .eq("batch_id", batchId)
    .eq("status", "queued");

  if (itemsErr) return j({ error: "items_query_failed", detail: itemsErr.message }, 500);
  if (!items || items.length === 0) return j({ prepared: 0, total_items: 0 });

  const handles = items.map((i: any) => i.influencer_handle);
  const { data: influencers } = await sb
    .from("influencers")
    .select("handle, wise_recipient_id, status")
    .in("handle", handles);
  const recipientByHandle = new Map<string, string>();
  for (const inf of influencers ?? []) {
    if (inf.status === "active" && inf.wise_recipient_id) {
      recipientByHandle.set(inf.handle, inf.wise_recipient_id);
    }
  }

  let prepared = 0;
  let failed = 0;
  for (const it of items) {
    const recipientId = recipientByHandle.get(it.influencer_handle);
    if (!recipientId) {
      await sb.from("influencer_payout_items")
        .update({ status: "failed", provider_error: "no_wise_recipient_or_inactive" })
        .eq("id", it.id);
      failed++;
      continue;
    }

    const sourceAmount = Number(it.amount_cents) / 100;
    if (sourceAmount <= 0) {
      await sb.from("influencer_payout_items")
        .update({ status: "skipped_below_min", provider_error: "zero_amount" })
        .eq("id", it.id);
      continue;
    }

    try {
      // 1. Create quote (sourceAmount in EUR, recipient currency from recipient lookup is implicit).
      const qRes = await wisePost(`/v3/profiles/${WISE_PROFILE}/quotes`, {
        sourceCurrency: WISE_SOURCE_CCY,
        targetCurrency: WISE_SOURCE_CCY, // safe default; override per-recipient in production
        sourceAmount,
        targetAccount: Number(recipientId),
        payOut: "BALANCE",
      });
      if (!qRes.ok) throw new Error(`quote_failed_${qRes.status}: ${await qRes.text()}`);
      const quote: any = await qRes.json();

      // 2. Create transfer
      const tRes = await wisePost("/v1/transfers", {
        targetAccount: Number(recipientId),
        quoteUuid: quote.id,
        customerTransactionId: `klar-${batchId}-${it.id}-${Date.now()}`,
        details: { reference: `Klar affiliate ${it.influencer_handle}` },
      });
      if (!tRes.ok) throw new Error(`transfer_failed_${tRes.status}: ${await tRes.text()}`);
      const transfer: any = await tRes.json();

      await sb.from("influencer_payout_items")
        .update({ status: "dispatched", provider: "wise", provider_ref: String(transfer.id), provider_error: null })
        .eq("id", it.id);
      prepared++;
    } catch (e) {
      await sb.from("influencer_payout_items")
        .update({ status: "failed", provider_error: String(e).slice(0, 480) })
        .eq("id", it.id);
      failed++;
    }
  }

  // Flip batch header to reflect outcome.
  if (prepared > 0) {
    await sb.from("influencer_payout_batches")
      .update({ status: failed === 0 ? "dispatched" : "dispatched", dispatched_at: new Date().toISOString() })
      .eq("id", batchId);
  } else if (failed > 0) {
    await sb.from("influencer_payout_batches")
      .update({ status: "failed", failure_reason: `${failed}/${items.length} items failed` })
      .eq("id", batchId);
  }

  return j({ prepared, total_items: items.length, failed });
});
