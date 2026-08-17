// SERVER ONLY. App Store Connect does not take a static bearer token: every
// request carries a short-lived JWT that the caller signs itself (ES256) with
// the .p8 private key Apple hands out once, at key creation.
//
// That is why an ASC key cannot ride the vault's normal path — the proxy only
// pastes a stored string onto a header, and there is no stored string here. The
// vault instead keeps the *key material* (issuer id + key id + .p8) as one
// encrypted JSON blob and mints a fresh JWT per proxied request, so the agent
// still never sees the private key.
//
// Reference: Apple, "Generating Tokens for API Requests".

import { createPrivateKey, sign as cryptoSign } from "crypto";

/** Marker on the stored JSON blob. Plain keys are never JSON, so this cannot
 *  collide with an ordinary secret. */
export const ASC_KIND = "asc_jwt";

export interface AscKeyMaterial {
  kind: typeof ASC_KIND;
  /** Team key: the Issuer ID from App Store Connect → Integrations. */
  issuerId: string;
  /** The 10-character Key ID (goes into the JWT header as `kid`). */
  keyId: string;
  /** PKCS#8 PEM, i.e. the contents of AuthKey_XXXXXXXXXX.p8. */
  p8: string;
  /** Individual keys authenticate as a person: `sub: "user"`, no issuer. */
  sub?: string;
}

const AUDIENCE = "appstoreconnect-v1";

// Apple rejects anything over 20 minutes. 15 leaves room for clock skew between
// Vercel and Apple, and the token is minted per request anyway — nothing here
// benefits from a longer life.
const TTL_SECONDS = 15 * 60;

function b64url(input: Buffer | string): string {
  return (typeof input === "string" ? Buffer.from(input, "utf8") : input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// A .p8 pasted through a form or an env var arrives in three shapes: real
// newlines, CRLF, or the literal two characters \n. createPrivateKey() accepts
// only the first, and fails with an opaque OpenSSL error on the others.
function normalizePem(raw: string): string {
  return raw.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
}

/** Parse the stored plaintext. Returns null for anything that is not an ASC
 *  blob, which is how callers tell an ASC secret from an ordinary key. */
export function parseAscKey(plain: string): AscKeyMaterial | null {
  const s = plain.trim();
  if (!s.startsWith("{")) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(s) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (o.kind !== ASC_KIND) return null;
  const issuerId = String(o.issuerId ?? "").trim();
  const keyId = String(o.keyId ?? "").trim();
  const sub = String(o.sub ?? "").trim();
  const p8 = normalizePem(String(o.p8 ?? ""));
  if (!keyId || !p8.includes("BEGIN PRIVATE KEY")) return null;
  // A team key needs the issuer; an individual key replaces it with sub:"user".
  if (!issuerId && !sub) return null;
  return { kind: ASC_KIND, issuerId, keyId, p8, sub: sub || undefined };
}

/** Build the blob that gets encrypted into `vault_secrets`. Throws if the .p8
 *  is not a usable EC private key, so a typo fails at save time (in the admin's
 *  face) instead of at request time as a silent 401 from Apple. */
export function packAscKey(input: {
  issuerId: string;
  keyId: string;
  p8: string;
  sub?: string;
}): string {
  const material: AscKeyMaterial = {
    kind: ASC_KIND,
    issuerId: input.issuerId.trim(),
    keyId: input.keyId.trim(),
    p8: normalizePem(input.p8),
    sub: input.sub?.trim() || undefined,
  };
  if (!material.keyId) throw new Error("asc: key id missing");
  if (!material.issuerId && !material.sub) throw new Error("asc: issuer id missing");
  // Round-trip through the real signer: proves the PEM parses AND that it is an
  // EC key ES256 can sign with.
  signAscJwt(material);
  return JSON.stringify(material);
}

/** Mint a bearer token for one App Store Connect request. */
export function signAscJwt(material: AscKeyMaterial, nowMs: number = Date.now()): string {
  const now = Math.floor(nowMs / 1000);
  const header = { alg: "ES256", kid: material.keyId, typ: "JWT" };
  const payload: Record<string, unknown> = {
    iat: now,
    exp: now + TTL_SECONDS,
    aud: AUDIENCE,
  };
  if (material.sub) payload.sub = material.sub;
  if (material.issuerId) payload.iss = material.issuerId;

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  // Node happily signs sha256 with an RSA key and ignores dsaEncoding, so a
  // wrong-but-valid PEM (someone's server key instead of the .p8) would produce
  // a well-formed token that only Apple rejects, as an unexplained 401. Check
  // the curve here, where the error can still name the cause.
  const key = createPrivateKey(material.p8);
  const curve = key.asymmetricKeyDetails?.namedCurve;
  if (key.asymmetricKeyType !== "ec" || curve !== "prime256v1") {
    throw new Error(`asc: ES256 needs a P-256 EC key, got ${key.asymmetricKeyType}/${curve ?? "?"}`);
  }
  // JOSE wants the raw r||s pair; OpenSSL's default for EC is DER, which Apple
  // rejects as a malformed signature. dsaEncoding switches that.
  const signature = cryptoSign("sha256", Buffer.from(signingInput, "utf8"), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${b64url(signature)}`;
}
