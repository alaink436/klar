import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTOTP } from "./totp";

// RFC 6238 appendix B: ASCII secret "12345678901234567890" (Base32 below).
// At T=59 s the SHA-1 code is 94287082, the last six digits are the 6-digit code.
const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const CODE_AT_59 = "287082";

function at(seconds: number) {
  vi.useFakeTimers();
  vi.setSystemTime(seconds * 1000);
}

describe("verifyTOTP", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts the code of the current step", async () => {
    at(59);
    expect(await verifyTOTP(SECRET, CODE_AT_59)).toBe(true);
  });

  it("accepts it one step later (clock skew)", async () => {
    at(59 + 30);
    expect(await verifyTOTP(SECRET, CODE_AT_59)).toBe(true);
  });

  it("rejects it two steps later (expired)", async () => {
    at(59 + 60);
    expect(await verifyTOTP(SECRET, CODE_AT_59)).toBe(false);
  });

  it("rejects a wrong code", async () => {
    at(59);
    expect(await verifyTOTP(SECRET, "287083")).toBe(false);
  });

  it("rejects malformed codes and an invalid secret", async () => {
    at(59);
    expect(await verifyTOTP(SECRET, "")).toBe(false);
    expect(await verifyTOTP(SECRET, "28708")).toBe(false);
    expect(await verifyTOTP(SECRET, "abcdef")).toBe(false);
    expect(await verifyTOTP("not base32!", CODE_AT_59)).toBe(false);
  });
});
