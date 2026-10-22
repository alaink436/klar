import { describe, expect, it } from "vitest";
import { errorText } from "./userjot";

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
