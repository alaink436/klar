import { NextResponse } from "next/server";
import Stripe from "stripe";

// One endpoint, two products: the one-time data purchase and the monthly
// learnings sync. The plan comes from the form, never from a price id in the
// request, so a crafted POST cannot invent its own price.
//
// Every env here is KLAROS_-prefixed. This app already talks to a different
// Supabase project (the Klar Hub) and will one day have Stripe of its own;
// un-prefixed SUPABASE_URL / STRIPE_SECRET_KEY would be an accident waiting
// to happen, and the accident is "charges the wrong account".
const PLANS = {
  data: { env: "KLAROS_STRIPE_PRICE_ID", mode: "payment" },
  sync: { env: "KLAROS_STRIPE_SYNC_PRICE_ID", mode: "subscription" },
};

export async function POST(req) {
  // .trim() everywhere: env values pasted via dashboard/CLI can carry stray
  // newlines, and Stripe rejects the resulting URLs as invalid.
  const key = (process.env.KLAROS_STRIPE_SECRET_KEY || "").trim();
  const site = (process.env.KLAROS_SITE_URL || "https://getklar.org").trim();

  let plan = "data";
  try {
    const form = await req.formData();
    const asked = String(form.get("plan") || "").trim();
    if (asked && PLANS[asked]) plan = asked;
  } catch {
    // no body: keep the default, which is the one-time purchase
  }

  const { env, mode } = PLANS[plan];
  const price = (process.env[env] || "").trim();

  if (!key || !price) {
    // Not configured yet: send the visitor back with an honest note rather
    // than a Stripe error page.
    return NextResponse.redirect(`${site}/?checkout=soon&plan=${plan}`, { status: 303 });
  }

  const stripe = new Stripe(key);
  const session = await stripe.checkout.sessions.create({
    mode,
    line_items: [{ price, quantity: 1 }],
    success_url: `${site}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/`,
    allow_promotion_codes: false,
    // Subscriptions get their invoices from the subscription itself; asking
    // for invoice_creation on top is rejected by Stripe.
    ...(mode === "payment" ? { invoice_creation: { enabled: true } } : {}),
  });

  return NextResponse.redirect(session.url, { status: 303 });
}
