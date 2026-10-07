import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signDeviceCookie } from "./deviceCookie";

// Pages and actions read the Cookie header through next/headers and leave via
// next/navigation; both stand in here for the Next runtime.
let requestCookie = "";
vi.mock("next/headers", () => ({
  headers: async () => new Headers(requestCookie ? { cookie: requestCookie } : {}),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

const { requireAdminAction, requireAdminPage, requireAdminRoute } = await import("./adminGuard");

const KEY = "admin-key";
const DEVICE_SECRET = "device-secret";

async function validCookie(): Promise<string> {
  const device = await signDeviceCookie(
    { deviceId: "dev-1", name: "Laptop", issuedAt: Math.floor(Date.now() / 1000) - 60 },
    DEVICE_SECRET,
  );
  return `klar_device=${encodeURIComponent(device)}; klar_admin=${KEY}`;
}

const req = (cookie = "") =>
  new Request("https://getklar.org/admin/inbox/star", { method: "POST", headers: cookie ? { cookie } : {} });

beforeEach(() => {
  vi.stubEnv("KLAR_ADMIN_KEY", KEY);
  vi.stubEnv("KLAR_DEVICE_SECRET", DEVICE_SECRET);
  vi.stubEnv("KLAR_TOTP_SECRET", "JBSWY3DPEHPK3PXP");
  requestCookie = "";
});
afterEach(() => vi.unstubAllEnvs());

describe("requireAdminRoute", () => {
  it("lets a valid session through with the device name", async () => {
    expect(await requireAdminRoute(req(await validCookie()))).toEqual({ ok: true, deviceName: "Laptop" });
  });

  it("answers 401 JSON to the admin key alone", async () => {
    const r = await requireAdminRoute(req(`klar_admin=${KEY}`));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.response.status).toBe(401);
    expect(await r.response.json()).toEqual({ ok: false, error: "unauthorized" });
  });

  it("answers 503 JSON when the configuration is missing", async () => {
    vi.stubEnv("KLAR_TOTP_SECRET", "");
    const r = await requireAdminRoute(req(await validCookie()));
    if (r.ok) throw new Error("expected refusal");
    expect(r.response.status).toBe(503);
    expect(await r.response.json()).toEqual({ ok: false, error: "admin not configured" });
  });

  it("redirects form posts to the login page", async () => {
    for (const cookie of ["", `klar_admin=${KEY}`]) {
      const r = await requireAdminRoute(req(cookie), "login");
      if (r.ok) throw new Error("expected refusal");
      expect(r.response.status).toBe(303);
      expect(r.response.headers.get("location")).toBe("https://getklar.org/admin/login");
    }
  });
});

describe("requireAdminPage", () => {
  it("returns the device name for a valid session", async () => {
    requestCookie = await validCookie();
    expect(await requireAdminPage()).toEqual({ deviceName: "Laptop" });
  });

  it("redirects to the login page otherwise", async () => {
    requestCookie = `klar_admin=${KEY}`;
    await expect(requireAdminPage()).rejects.toThrow("redirect:/admin/login");
  });
});

describe("requireAdminAction", () => {
  it("returns ok for a valid session", async () => {
    requestCookie = await validCookie();
    expect(await requireAdminAction()).toEqual({ ok: true, deviceName: "Laptop" });
  });

  it("returns an error instead of throwing", async () => {
    expect(await requireAdminAction()).toEqual({ ok: false, error: "unauthorized" });
    vi.stubEnv("KLAR_ADMIN_KEY", "");
    expect(await requireAdminAction()).toEqual({ ok: false, error: "admin not configured" });
  });
});
