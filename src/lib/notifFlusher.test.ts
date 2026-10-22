import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/vault", () => ({ getForProxy: async () => null }));

import { digestCounts } from "./notifFlusher";

describe("digestCounts", () => {
  it("names creator sign-ups and website inquiries apart", () => {
    expect(digestCounts([{ event_type: "creator_signup" }])).toBe("1 neue Anmeldung");
    expect(digestCounts([{ event_type: "inquiry_new" }, { event_type: "inquiry_new" }])).toBe("2 neue Inquiries");
    expect(
      digestCounts([{ event_type: "creator_signup" }, { event_type: "creator_signup" }, { event_type: "inquiry_new" }]),
    ).toBe("2 neue Anmeldungen, 1 neue Inquiry");
  });
});
