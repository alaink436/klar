// RFC 6238 TOTP verifier. Pure Web Crypto (HMAC-SHA1) — no npm dep.
// Used by /admin/login to verify codes from Google Authenticator / Authy /
// 1Password against KLAR_TOTP_SECRET (Base32). Constant-time compare, ±1
// step skew (so a code stays valid for the 30s before/after its window).
//
// Secret format: standard Base32 (RFC 4648, case-insensitive, "=" padding
// optional). Authenticator apps accept Base32 secrets in their "manual
// entry" flow; that's the only input format we support.

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Uint8Array {
  const s = input.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  const bytes: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of s) {
    const v = BASE32.indexOf(ch);
    if (v < 0) throw new Error(`Invalid Base32 char: ${ch}`);
    buf = (buf << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buf >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function counterBytes(counter: number): Uint8Array {
  const b = new Uint8Array(8);
  // JS bitwise is 32-bit. counter fits in 53-bit safe int for centuries.
  let v = counter;
  for (let i = 7; i >= 0; i--) {
    b[i] = v & 0xff;
    v = Math.floor(v / 256);
  }
  return b;
}

async function hotp(secret: Uint8Array, counter: number, digits = 6): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    secret as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, counterBytes(counter) as BufferSource),
  );
  const offset = mac[mac.length - 1] & 0x0f;
  const truncated =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff);
  return String(truncated % 10 ** digits).padStart(digits, "0");
}

function ctEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Verify a 6-digit code against the Base32 secret. Allows ±1 step skew
// (±30 s) to absorb clock drift between server and authenticator.
export async function verifyTOTP(secretBase32: string, code: string): Promise<boolean> {
  const clean = (code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  let secret: Uint8Array;
  try {
    secret = base32Decode(secretBase32);
  } catch {
    return false;
  }
  if (secret.length === 0) return false;
  const step = 30;
  const now = Math.floor(Date.now() / 1000 / step);
  for (const skew of [0, -1, 1]) {
    const expected = await hotp(secret, now + skew);
    if (ctEqual(expected, clean)) return true;
  }
  return false;
}

// Build an otpauth:// URL for the user's authenticator app (manual entry or
// QR-render via any external tool). Issuer + label are URL-encoded; secret
// is passed as-is (must already be Base32).
export function otpauthUrl(secretBase32: string, label = "admin", issuer = "Klar Control"): string {
  const lbl = encodeURIComponent(`${issuer}:${label}`);
  const iss = encodeURIComponent(issuer);
  return `otpauth://totp/${lbl}?secret=${secretBase32}&issuer=${iss}&algorithm=SHA1&digits=6&period=30`;
}
