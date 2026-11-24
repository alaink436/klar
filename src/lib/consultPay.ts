import { createHash, randomUUID } from "node:crypto";

// The RevenueCat Web Billing checkout for a consult (project "Klar Studios", web purchase link "Consult checkout",
// offering "consult", CHF 99). Used by /consult/pay, where cal.com sends a guest after booking.
export const CONSULT_CHECKOUT = "https://pay.rev.cat/zrtrqnpcpbnozqkx";

const EMAIL = /^[^\s@]+@[^\s@]+$/;

/** The same guest email always gets the same RevenueCat id, so a repeat customer is one customer there. */
export function consultUserId(email: string | null): string {
  const e = email?.trim().toLowerCase();
  if (e && EMAIL.test(e)) return "consult_" + createHash("sha256").update(e).digest("hex").slice(0, 24);
  return "consult_" + randomUUID().replace(/-/g, "").slice(0, 24);
}

export function consultCheckoutUrl(email: string | null): string {
  const target = new URL(`${CONSULT_CHECKOUT}/${consultUserId(email)}`);
  const e = email?.trim();
  if (e && EMAIL.test(e)) target.searchParams.set("email", e);
  return target.toString();
}
