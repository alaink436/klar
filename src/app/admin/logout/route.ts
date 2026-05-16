// Clears the Klar Control admin cookie and returns to the login page.

export const dynamic = "force-dynamic";

export function GET(): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/admin",
      "Set-Cookie": "klar_admin=; HttpOnly; Secure; SameSite=Lax; Path=/admin; Max-Age=0",
    },
  });
}
