// Clears the Klar Control session cookie and returns to the login page.
// Cleart sowohl den canonical Path=/admin Cookie als auch den S30e-legacy
// Path=/ Cookie (Browser haben den eventuell noch im Storage).

import { endSessionCookies } from "@/lib/adminSession";

export const dynamic = "force-dynamic";

export function GET(): Response {
  const headers = new Headers({ Location: "/admin" });
  for (const c of endSessionCookies()) headers.append("Set-Cookie", c);
  return new Response(null, { status: 303, headers });
}
