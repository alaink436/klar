// Thin adapters from the admin session (./adminSession) to the three places
// that need it. Each one only translates the decision into what its caller
// can return; none of them decides anything itself.
//   - page:   anything but `ok` redirects to the login page.
//   - route:  `ok` hands back the device name, otherwise a ready Response:
//             "json"  -> 503 {ok:false,error:"admin not configured"} or
//                        401 {ok:false,error:"unauthorized"} (fetch callers)
//             "login" -> 303 to /admin/login (form posts and GETs; the login
//                        page itself explains a missing configuration)
//   - action: a result instead of a throw, so the client gets an answer.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readAdminSession } from "./adminSession";

const LOGIN = "/admin/login";

export async function requireAdminPage(): Promise<{ deviceName: string }> {
  const session = await readAdminSession((await headers()).get("cookie"));
  if (session.status !== "ok") redirect(LOGIN);
  return { deviceName: session.deviceName };
}

export async function requireAdminRoute(
  req: Request,
  onDenied: "json" | "login" = "json",
): Promise<{ ok: true; deviceName: string } | { ok: false; response: Response }> {
  const session = await readAdminSession(req.headers.get("cookie"));
  if (session.status === "ok") return { ok: true, deviceName: session.deviceName };
  if (onDenied === "login") {
    return { ok: false, response: Response.redirect(new URL(LOGIN, req.url), 303) };
  }
  return session.status === "not-configured"
    ? { ok: false, response: Response.json({ ok: false, error: "admin not configured" }, { status: 503 }) }
    : { ok: false, response: Response.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
}

export async function requireAdminAction(): Promise<
  { ok: true; deviceName: string } | { ok: false; error: string }
> {
  const session = await readAdminSession((await headers()).get("cookie"));
  if (session.status === "ok") return { ok: true, deviceName: session.deviceName };
  return { ok: false, error: session.status === "not-configured" ? "admin not configured" : "unauthorized" };
}
