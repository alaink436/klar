// Admin session: the one place that decides whether a request may enter Klar
// Control. Inputs are the configuration, the request's Cookie header and the
// clock; the answer is one of four cases. Pages, routes and server actions
// reach it through the thin adapters in ./adminGuard; login and logout use the
// cookie helpers below to start and end a session.
//
// A request is admitted when both cookies hold:
//   - klar_device: HMAC-signed device cookie (see ./deviceCookie), issued by
//     the login after admin key or invite plus TOTP. Without it the browser is
//     unknown.
//   - klar_admin: the session cookie. Its value is KLAR_ADMIN_KEY itself (the
//     format predates this module and stays, so live sessions remain valid).
//     Only the login sets it, and only after a correct TOTP code, so a valid
//     session cookie stands for "TOTP passed within the last 12 h".
// All secret comparisons run in constant time.

import { verifyDeviceCookie } from "./deviceCookie";

const DEVICE_COOKIE = "klar_device";
const SESSION_COOKIE = "klar_admin";
const SESSION_MAX_AGE = 12 * 60 * 60; // 12 h

export interface AdminConfig {
  adminKey: string; // KLAR_ADMIN_KEY
  deviceSecret: string; // KLAR_DEVICE_SECRET
  totpSecret: string; // KLAR_TOTP_SECRET
}

export function adminConfig(env: Record<string, string | undefined> = process.env): AdminConfig {
  return {
    adminKey: env.KLAR_ADMIN_KEY ?? "",
    deviceSecret: env.KLAR_DEVICE_SECRET ?? "",
    totpSecret: env.KLAR_TOTP_SECRET ?? "",
  };
}

// `no-session` keeps the device name: the login page greets a known device and
// asks it for the TOTP code only.
export type AdminSession =
  | { status: "ok"; deviceName: string }
  | { status: "not-configured" }
  | { status: "no-device" }
  | { status: "no-session"; deviceName: string };

export async function readAdminSession(
  cookieHeader: string | null | undefined,
  config: AdminConfig = adminConfig(),
  now: number = Date.now(),
): Promise<AdminSession> {
  if (!config.adminKey || !config.deviceSecret || !config.totpSecret) {
    return { status: "not-configured" };
  }
  const device = await verifyDeviceCookie(
    readCookie(cookieHeader, DEVICE_COOKIE),
    config.deviceSecret,
    Math.floor(now / 1000),
  );
  if (!device) return { status: "no-device" };
  if (!ctEqual(readCookie(cookieHeader, SESSION_COOKIE), config.adminKey)) {
    return { status: "no-session", deviceName: device.name };
  }
  return { status: "ok", deviceName: device.name };
}

// Login on a new device: the typed admin key against KLAR_ADMIN_KEY.
export function adminKeyMatches(input: string, config: AdminConfig = adminConfig()): boolean {
  return Boolean(config.adminKey) && ctEqual(input, config.adminKey);
}

// Set-Cookie values that start a session. Also clears the pre-S30e copy on
// Path=/ that older browsers may still carry.
export function startSessionCookies(config: AdminConfig = adminConfig()): string[] {
  return [
    `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
    `${SESSION_COOKIE}=${encodeURIComponent(config.adminKey)}; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=${SESSION_MAX_AGE}`,
  ];
}

// Set-Cookie values that end a session (canonical Path=/admin and the legacy
// Path=/ copy). The device cookie stays: the browser remains a known device.
export function endSessionCookies(): string[] {
  return [
    `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=0`,
    `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
  ];
}

/** One cookie from a Cookie header; "" when missing or not decodable. Pages
 *  read the language and menu cookies with it too. */
export function readCookie(header: string | null | undefined, name: string): string {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k !== name) continue;
    try {
      return decodeURIComponent(v.join("="));
    } catch {
      return "";
    }
  }
  return "";
}

/** Constant-time string comparison (UTF-8 bytes). lib/totp and the brain
 *  export route use it as well. */
export function ctEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
}
