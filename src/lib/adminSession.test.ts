import { describe, expect, it } from "vitest";
import {
  adminConfig,
  adminKeyMatches,
  endSessionCookies,
  readAdminSession,
  startSessionCookies,
  type AdminConfig,
  type AdminSession,
} from "./adminSession";
import { signDeviceCookie } from "./deviceCookie";

const CONFIG: AdminConfig = { adminKey: "admin-key;=ä", deviceSecret: "device-secret", totpSecret: "JBSWY3DPEHPK3PXP" };
const NOW = Date.UTC(2026, 9, 7, 12, 0, 0);
const nowS = Math.floor(NOW / 1000);
const DAY = 24 * 60 * 60;

// Both cookies exactly as a browser sends back what the login set.
const device = async (issuedAt = nowS - DAY, secret = CONFIG.deviceSecret) =>
  `klar_device=${encodeURIComponent(await signDeviceCookie({ deviceId: "dev-1", name: "PC", issuedAt }, secret))}`;
const session = (key = CONFIG.adminKey) => `klar_admin=${encodeURIComponent(key)}`;
const header = (...parts: string[]) => parts.join("; ");

describe("readAdminSession", () => {
  const cases: Array<{ name: string; config?: AdminConfig; cookie: () => Promise<string>; want: AdminSession }> = [
    { name: "admin key missing", config: { ...CONFIG, adminKey: "" }, cookie: async () => header(await device(), session()), want: { status: "not-configured" } },
    { name: "device secret missing", config: { ...CONFIG, deviceSecret: "" }, cookie: async () => header(await device(), session()), want: { status: "not-configured" } },
    { name: "TOTP secret missing", config: { ...CONFIG, totpSecret: "" }, cookie: async () => header(await device(), session()), want: { status: "not-configured" } },
    { name: "no cookies at all", cookie: async () => "", want: { status: "no-device" } },
    { name: "session without device (admin key alone)", cookie: async () => session(), want: { status: "no-device" } },
    { name: "device signed with another secret", cookie: async () => header(await device(nowS - DAY, "other"), session()), want: { status: "no-device" } },
    { name: "device older than a year", cookie: async () => header(await device(nowS - 366 * DAY), session()), want: { status: "no-device" } },
    { name: "device issued in the future", cookie: async () => header(await device(nowS + 3600), session()), want: { status: "no-device" } },
    { name: "device without session", cookie: async () => header("lang=de", await device()), want: { status: "no-session", deviceName: "PC" } },
    { name: "device with wrong session", cookie: async () => header(await device(), session("wrong")), want: { status: "no-session", deviceName: "PC" } },
    { name: "device with session one char short", cookie: async () => header(await device(), session(CONFIG.adminKey.slice(0, -1))), want: { status: "no-session", deviceName: "PC" } },
    { name: "device with undecodable session", cookie: async () => header(await device(), "klar_admin=%E0%A4%A"), want: { status: "no-session", deviceName: "PC" } },
    { name: "everything valid", cookie: async () => header("klar_lang=en", await device(), session()), want: { status: "ok", deviceName: "PC" } },
  ];

  for (const c of cases) {
    it(c.name, async () => {
      expect(await readAdminSession(await c.cookie(), c.config ?? CONFIG, NOW)).toEqual(c.want);
    });
  }

  it("treats a missing Cookie header like an empty one", async () => {
    expect(await readAdminSession(null, CONFIG, NOW)).toEqual({ status: "no-device" });
  });
});

describe("session cookies", () => {
  // Pre-module format, byte for byte: live sessions must stay valid.
  it("keeps the session cookie format", () => {
    expect(startSessionCookies(CONFIG)).toContain(
      `klar_admin=${encodeURIComponent(CONFIG.adminKey)}; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=43200`,
    );
  });

  it("starts a session the reader accepts", async () => {
    const set = startSessionCookies(CONFIG).find((c) => c.includes("Path=/admin"))!;
    const cookie = header(await device(), set.split(";")[0]);
    expect(await readAdminSession(cookie, CONFIG, NOW)).toEqual({ status: "ok", deviceName: "PC" });
  });

  it("ends the session on both paths and leaves the device", () => {
    const end = endSessionCookies();
    expect(end).toEqual([
      "klar_admin=; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=0",
      "klar_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
    ]);
    expect(end.some((c) => c.startsWith("klar_device"))).toBe(false);
  });
});

describe("adminKeyMatches", () => {
  it("accepts the configured key only", () => {
    expect(adminKeyMatches(CONFIG.adminKey, CONFIG)).toBe(true);
    expect(adminKeyMatches("admin-key;=a", CONFIG)).toBe(false);
    expect(adminKeyMatches("", CONFIG)).toBe(false);
  });

  it("never matches when no key is configured", () => {
    expect(adminKeyMatches("", { ...CONFIG, adminKey: "" })).toBe(false);
  });
});

describe("adminConfig", () => {
  it("reads the three variables and defaults to empty", () => {
    expect(adminConfig({ KLAR_ADMIN_KEY: "k", KLAR_DEVICE_SECRET: "d" })).toEqual({ adminKey: "k", deviceSecret: "d", totpSecret: "" });
  });
});
