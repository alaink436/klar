// Clears the Klar Control admin cookie and returns to the login page.
// Both the new Path=/ cookie AND any legacy Path=/admin cookie (from before
// S30e) get cleared.

export const dynamic = "force-dynamic";

export function GET(): Response {
  const headers = new Headers({ Location: "/admin" });
  // New cookies (Path=/)
  headers.append("Set-Cookie", "klar_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");
  // Legacy cookies (Path=/admin) — cleanup for browsers that still have them
  headers.append("Set-Cookie", "klar_admin=; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=0");
  return new Response(null, { status: 303, headers });
}
