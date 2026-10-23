import { describe, expect, it } from "vitest";
import { USERJOT_APPS, WORKSPACE_ID, clientToken, errorText, signUserId, signedBoardUrl } from "./userjot";

describe("errorText", () => {
  it("names the plan when the API is not part of it", () => {
    const body = { error: { code: "plan_feature_unavailable", message: "x", details: { feature: "api_access" } } };
    expect(errorText(409, body)).toContain("keinen API-Zugang");
  });

  it("asks for a new token on 401", () => {
    expect(errorText(401, { error: { code: "invalid_api_token", message: "x" } })).toContain("Token");
  });

  it("passes UserJot's own message through, or the status without one", () => {
    expect(errorText(422, { error: { code: "validation_error", message: "limit too big" } })).toBe("limit too big");
    expect(errorText(500, null)).toBe("UserJot antwortet 500.");
  });
});

describe("automatic login", () => {
  // HMAC-SHA256("user-1") with the key "secret", hex: the documented recipe.
  const SIG = "1d16fd7e96e8a9681f283b8a251822ffdc71e2a5bda0c5267a044874fa21b82b";

  it("signs the user id with the project secret", () => {
    expect(signUserId("secret", "user-1")).toBe(SIG);
  });

  it("builds the token the way UserJot's SDK does: sorted keys, base64 JSON", () => {
    const json = Buffer.from(clientToken({ id: "user-1", firstName: " Lisa " }, SIG), "base64").toString("utf8");
    expect(json).toBe(`{"id":"${WORKSPACE_ID}","user":{"firstName":"Lisa","id":"user-1","signature":"${SIG}"}}`);
  });

  it("leaves an empty name out", () => {
    const json = Buffer.from(clientToken({ id: "user-1", firstName: "  " }, SIG), "base64").toString("utf8");
    expect(json).toBe(`{"id":"${WORKSPACE_ID}","user":{"id":"user-1","signature":"${SIG}"}}`);
  });

  it("puts the token on the app's own board, encoded", () => {
    const url = new URL(signedBoardUrl(USERJOT_APPS[0], { id: "user-1", firstName: "Lisa" }, "secret"));
    expect(url.origin + url.pathname).toBe("https://klarstudios.userjot.com/board/basalt");
    const token = url.searchParams.get("clientToken") ?? "";
    expect(JSON.parse(Buffer.from(token, "base64").toString("utf8")).user.signature).toBe(SIG);
  });
});
