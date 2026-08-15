import Stripe from "stripe";
import OsShell from "../os/OsShell";

export const dynamic = "force-dynamic";

const DELIVERY_URL = "https://ptkexxtsvdgmspuhlsls.supabase.co/functions/v1/deliver-playbook";

export const metadata = {
  title: "Klar OS — your download",
  robots: { index: false, follow: false },
};

export default async function Success({ searchParams }) {
  const { session_id } = await searchParams;
  const key = process.env.KLAROS_STRIPE_SECRET_KEY;

  let paid = false;
  let email = null;

  if (key && session_id) {
    try {
      const stripe = new Stripe(key);
      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ["line_items"],
      });
      // Pin to THIS product: any other paid session in the account must not
      // unlock the download (refunds keep payment_status 'paid', other
      // products' sessions are paid too).
      //
      // Matched on the PRODUCT, not the price: prices change (currency swap,
      // $49 -> $79 at launch) and every earlier buyer would lose their download
      // the moment the price env moves on. The product id outlives all of it.
      // Falls back to the price id when no product is configured.
      const productId = (process.env.KLAROS_STRIPE_PRODUCT_ID || "").trim();
      const priceId = (process.env.KLAROS_STRIPE_PRICE_ID || "").trim();
      const items = session.line_items?.data ?? [];
      const isThisProduct = productId
        ? items.some((li) => li.price?.product === productId)
        : !priceId || items.some((li) => li.price?.id === priceId);
      paid = session.payment_status === "paid" && isThisProduct;
      email = session.customer_details?.email ?? null;
    } catch {
      paid = false;
    }
  }

  return (
    <OsShell>
      <main className="wrap">
        {paid ? (
          <>
            <h1>You&apos;re in. Thank you.</h1>
            <p>
              Your pre-order is confirmed{email ? ` (receipt goes to ${email})` : ""}.
              You can download today&apos;s version right now. The Playbook
              keeps growing until <b>September 15, 2026</b>, and this same page
              always serves the latest build.
            </p>
            <div className="panel" style={{ padding: "var(--space-5)" }}>
              <p style={{ margin: 0 }}>
                <a className="btn pay" href={`${DELIVERY_URL}?session_id=${encodeURIComponent(session_id)}`}>
                  Download the Playbook (zip)
                </a>
              </p>
              <p className="fine">
                Delivered against your checkout session: the link works for you,
                on any device, whenever you come back to this page.
              </p>
            </div>
            <p className="dim">
              Want to shape the onboarding chapter? Reply to your receipt email
              with the one thing about agent workflows that annoys you most.
              And if you want platform-specific ship playbooks next (iOS first:
              App Store review, TestFlight discipline, OTA updates, learned across six
              shipped apps), reply with <b>&quot;iOS&quot;</b> or
              <b>&quot;Web&quot;</b> for first-buyer pricing on the add-on.
            </p>
          </>
        ) : (
          <>
            <h1>Payment not confirmed.</h1>
            <p className="dim">
              If you just paid, wait a few seconds and refresh. Otherwise head{" "}
              <a href="/">back to the page</a> and try again, or reply to any
              email from us and a human answers.
            </p>
          </>
        )}
      </main>
    </OsShell>
  );
}
