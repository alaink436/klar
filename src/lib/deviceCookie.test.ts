import { describe, expect, it } from "vitest";
import { signDeviceCookie, verifyDeviceCookie, type DevicePayload } from "./deviceCookie";

const SECRET = "test-device-secret";
const now = () => Math.floor(Date.now() / 1000);
const payload = (issuedAt = now()): DevicePayload => ({ deviceId: "dev-1", name: "PC", issuedAt });

describe("device cookie", () => {
  it("accepts a cookie it signed and returns the payload", async () => {
    const p = payload();
    const cookie = await signDeviceCookie(p, SECRET);
    expect(await verifyDeviceCookie(cookie, SECRET)).toEqual(p);
  });

  it("rejects a cookie signed with another secret", async () => {
    const cookie = await signDeviceCookie(payload(), "other-secret");
    expect(await verifyDeviceCookie(cookie, SECRET)).toBeNull();
  });

  it("rejects a cookie whose payload was swapped after signing", async () => {
    const [, sig] = (await signDeviceCookie(payload(), SECRET)).split(".");
    const [head] = (await signDeviceCookie({ ...payload(), name: "Fremd" }, "x")).split(".");
    expect(await verifyDeviceCookie(`${head}.${sig}`, SECRET)).toBeNull();
  });

  it("rejects a cookie older than a year", async () => {
    const cookie = await signDeviceCookie(payload(now() - 366 * 24 * 60 * 60), SECRET);
    expect(await verifyDeviceCookie(cookie, SECRET)).toBeNull();
  });

  it("rejects a cookie issued in the future", async () => {
    const cookie = await signDeviceCookie(payload(now() + 3600), SECRET);
    expect(await verifyDeviceCookie(cookie, SECRET)).toBeNull();
  });

  it("rejects garbage and a missing secret", async () => {
    expect(await verifyDeviceCookie("", SECRET)).toBeNull();
    expect(await verifyDeviceCookie("not-a-cookie", SECRET)).toBeNull();
    expect(await verifyDeviceCookie(await signDeviceCookie(payload(), SECRET), "")).toBeNull();
  });
});
