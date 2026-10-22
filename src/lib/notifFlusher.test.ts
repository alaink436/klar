import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/vault", () => ({ getForProxy: async () => null }));

import { buildDigestHtml, digestCounts } from "./notifFlusher";

describe("digestCounts", () => {
  it("names creator sign-ups and website inquiries apart", () => {
    expect(digestCounts([{ event_type: "creator_signup" }])).toBe("1 neue Anmeldung");
    expect(digestCounts([{ event_type: "inquiry_new" }, { event_type: "inquiry_new" }])).toBe("2 neue Inquiries");
    expect(
      digestCounts([{ event_type: "creator_signup" }, { event_type: "creator_signup" }, { event_type: "inquiry_new" }]),
    ).toBe("2 neue Anmeldungen, 1 neue Inquiry");
  });
});

describe("buildDigestHtml", () => {
  const event = (created_at: string) => ({
    id: 1, event_type: "creator_signup" as const, app_slug: "basalt", handle: "klar_test_demo", inquiry_id: null, payload: {}, created_at,
  });
  it("shows Swiss time, summer and winter", () => {
    expect(buildDigestHtml([event("2026-10-22T08:54:21Z")]).html).toContain("22.10.2026, 10:54");
    expect(buildDigestHtml([event("2026-12-01T08:54:21Z")]).html).toContain("01.12.2026, 09:54");
  });
});
