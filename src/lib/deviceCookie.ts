// HMAC-signed device cookie. After a successful admin-key + TOTP login on a
// new browser, the server issues a klar_device cookie that contains an
// opaque payload (deviceId + issuedAt + name) plus an HMAC-SHA256 signature.
// Only browsers presenting a cookie with a valid sig can talk to /admin.
//
// Format on the wire: base64url(payloadJson) "." base64url(hmacBytes)
// Signing key: KLAR_DEVICE_SECRET (any string, treated as raw UTF-8 bytes).
//
// Threat model: the cookie is sealed against forgery but not against theft.
// HttpOnly + Secure + SameSite=Strict + Path=/admin keep it out of JS,
// off non-HTTPS, and off third-party requests. Recovery from theft = rotate
// KLAR_DEVICE_SECRET (invalidates every existing cookie at once).

export interface DevicePayload {
  deviceId: string; // random per-device, used for revocation UI later
  name: string; // user-supplied label ("PC", "Laptop"), purely for display
  issuedAt: number; // unix seconds
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmac(secret: string, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(msg) as BufferSource,
  );
  return new Uint8Array(sig);
}

function ctEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}

export async function signDeviceCookie(payload: DevicePayload, secret: string): Promise<string> {
  if (!secret) throw new Error("KLAR_DEVICE_SECRET not set");
  const json = JSON.stringify(payload);
  const head = b64urlEncode(new TextEncoder().encode(json));
  const sig = await hmac(secret, head);
  return `${head}.${b64urlEncode(sig)}`;
}

export async function verifyDeviceCookie(
  raw: string,
  secret: string,
): Promise<DevicePayload | null> {
  if (!raw || !secret) return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [head, sigB64] = parts;
  let expected: Uint8Array;
  try {
    expected = await hmac(secret, head);
  } catch {
    return null;
  }
  let got: Uint8Array;
  try {
    got = b64urlDecode(sigB64);
  } catch {
    return null;
  }
  if (!ctEqualBytes(expected, got)) return null;
  try {
    const json = new TextDecoder().decode(b64urlDecode(head));
    const obj = JSON.parse(json) as DevicePayload;
    if (
      typeof obj !== "object" ||
      typeof obj.deviceId !== "string" ||
      typeof obj.name !== "string" ||
      typeof obj.issuedAt !== "number"
    ) {
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}

// 10-year cookie. Path=/ damit der Cookie auch an /api/affiliate/{approve,
// complete} und andere admin-protected API-Routes außerhalb /admin geht.
// SameSite=Strict means CSRF-safe AND no cookie when arriving via external
// links — first-visit-from-Twitter still hits the login page, as intended.
// HttpOnly + Secure halten ihn aus JS und nicht-HTTPS raus.
export function deviceCookieHeader(value: string): string {
  return `klar_device=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${10 * 365 * 24 * 60 * 60}`;
}

export function deviceCookieClear(): string {
  return `klar_device=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function newDeviceId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return b64urlEncode(bytes);
}
