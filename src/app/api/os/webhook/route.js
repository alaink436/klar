import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Stripe webhook for Klar OS. Two shapes arrive here:
//   payment      -> a row in purchases, the one-time data buy
//   subscription -> a row in subscriptions, the monthly learnings sync
//
// A subscription is not a purchase with a different price: it ends. It lapses
// on a failed card, it gets cancelled, and access has to follow. So the
// lifecycle events are handled too, not just the first checkout.
const RELEVANT = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

// A subscriber's token is what their agent uses to pull new learnings. Random,
// unguessable, and stored as-is because it is a capability, not a credential
// that unlocks anything else.
function mintToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return "kos_" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function POST(req) {
  const key = (process.env.KLAROS_STRIPE_SECRET_KEY || "").trim();
  const whSecret = (process.env.KLAROS_STRIPE_WEBHOOK_SECRET || "").trim();
  if (!key || !whSecret) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const stripe = new Stripe(key);
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch (err) {
    return NextResponse.json({ error: `signature: ${err.message}` }, { status: 400 });
  }

  if (!RELEVANT.has(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const url = (process.env.KLAROS_SUPABASE_URL || "").trim();
  const serviceKey = (process.env.KLAROS_SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceKey) {
    // Non-2xx makes Stripe retry instead of silently losing the event.
    return NextResponse.json({ error: "db not configured" }, { status: 503 });
  }
  const supabase = createClient(url, serviceKey);

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;

    if (s.mode === "subscription") {
      const { error } = await supabase.from("subscriptions").upsert(
        {
          stripe_subscription_id: s.subscription,
          stripe_customer_id: s.customer,
          email: s.customer_details?.email ?? null,
          status: "active",
          token: mintToken(),
          plan: "learnings_sync",
        },
        { onConflict: "stripe_subscription_id" }
      );
      if (error) return NextResponse.json({ error: "db write failed" }, { status: 500 });
      return NextResponse.json({ received: true, kind: "subscription" });
    }

    const { error } = await supabase.from("purchases").upsert(
      {
        stripe_session_id: s.id,
        email: s.customer_details?.email ?? null,
        amount_total: s.amount_total,
        currency: s.currency,
        status: "paid",
        entitlement: "brain_kit_v1",
      },
      { onConflict: "stripe_session_id" }
    );
    if (error) return NextResponse.json({ error: "db write failed" }, { status: 500 });
    return NextResponse.json({ received: true, kind: "purchase" });
  }

  // Lifecycle: mirror Stripe's own status rather than inventing one, so a
  // past_due card or a cancellation closes access without a second source of
  // truth to keep in step.
  const sub = event.data.object;
  const id = sub.id || sub.subscription;
  const status =
    event.type === "customer.subscription.deleted" ? "cancelled"
    : event.type === "invoice.payment_failed" ? "past_due"
    : sub.status || "active";

  if (!id) return NextResponse.json({ received: true, note: "no subscription id" });

  const { error } = await supabase
    .from("subscriptions")
    .update({ status })
    .eq("stripe_subscription_id", id);
  if (error) return NextResponse.json({ error: "db write failed" }, { status: 500 });

  return NextResponse.json({ received: true, kind: "lifecycle", status });
}
