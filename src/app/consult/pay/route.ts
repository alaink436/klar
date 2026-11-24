import { consultCheckoutUrl } from "@/lib/consultPay";

// getklar.org/consult/pay: cal.com sends a guest here after booking a consult (events "consult" and
// "consult-anfrage" redirect here and forward their booking params, among them the guest's email). From here
// on to the RevenueCat checkout, so every paid consult shows up in RevenueCat (Alain 2026-11-24: "ich möchte
// alles auf revenuecat app sehen können").
export function GET(req: Request): Response {
  return Response.redirect(consultCheckoutUrl(new URL(req.url).searchParams.get("email")), 302);
}
