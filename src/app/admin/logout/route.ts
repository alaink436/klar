// Clears the Klar Control admin cookie and returns to the login page.
// Cleart sowohl den canonical Path=/admin Cookie als auch den S30e-legacy
// Path=/ Cookie (Browser haben den eventuell noch im Storage).

export const dynamic = "force-dynamic";

export function GET(): Response {
  const headers = new Headers({ Location: "/admin" });
  // Canonical (Path=/admin)
  headers.append("Set-Cookie", "klar_admin=; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=0");
  // S30e legacy (Path=/) — cleanup for browsers that still have them
  headers.append("Set-Cookie", "klar_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");
  return new Response(null, { status: 303, headers });
}
