import { describe, expect, it } from "vitest";
import { consultCheckoutUrl, consultUserId } from "./consultPay";

describe("consult checkout", () => {
  it("gives the same guest the same RevenueCat id, whatever the case", () => {
    expect(consultUserId("Anna@Example.com")).toBe(consultUserId(" anna@example.com "));
    expect(consultUserId("anna@example.com")).toMatch(/^consult_[0-9a-f]{24}$/);
  });

  it("falls back to a random id without a usable email", () => {
    expect(consultUserId(null)).toMatch(/^consult_[0-9a-f]{24}$/);
    expect(consultUserId("not-an-email")).not.toBe(consultUserId("not-an-email"));
  });

  it("puts the id in the path and prefills the email", () => {
    const to = new URL(consultCheckoutUrl("anna@example.com"));
    expect(to.origin + to.pathname).toBe(`https://pay.rev.cat/zrtrqnpcpbnozqkx/${consultUserId("anna@example.com")}`);
    expect(to.searchParams.get("email")).toBe("anna@example.com");
    expect(new URL(consultCheckoutUrl(null)).search).toBe("");
  });
});
