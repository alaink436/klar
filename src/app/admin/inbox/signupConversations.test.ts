import { describe, expect, it } from "vitest";
import { signupConversations } from "./signupConversations";
import type { AccountStatus, CreatorAccount } from "@/lib/creatorAccounts";

const account = (over: Partial<CreatorAccount & { status: AccountStatus }> = {}): CreatorAccount & { status: AccountStatus } => ({
  id: "a1",
  user_id: "u1",
  email: "pete@gmail.com",
  app_slug: "basalt",
  tiktok_handle: "babysphinx8",
  country: "US",
  platforms: ["tiktok"],
  has_link: true,
  bio_code: "klar-ZCFZ",
  verified_at: null,
  created_at: "2026-10-22T05:13:38Z",
  strikes: 0,
  suspended_until: null,
  closed_at: null,
  followers: null,
  status: "waiting",
  ...over,
});

describe("signupConversations", () => {
  it("shows a sign-up as an entry with its status, code and Swiss time", () => {
    const [c] = signupConversations([account()], []);
    expect(c).toMatchObject({ id: "signup-a1", kind: "signup", handle: "babysphinx8", contactEmail: "pete@gmail.com", apps: ["wavelength"], replyCount: 0 });
    expect(c.signup).toEqual({ status: "wartet auf Bio-Code", at: "angemeldet", tiktok: "https://www.tiktok.com/@babysphinx8" });
    expect(c.messages[0].body).toContain("der Code klar-ZCFZ fehlt noch in der TikTok-Bio");
    expect(c.messages[0].body).toContain("Angemeldet: 22.10.26, 07:13");
  });

  it("shows an account without TikTok by its mail address, as a sign-up", () => {
    const [c] = signupConversations([account({ tiktok_handle: null, country: null, status: "unconnected" })], []);
    expect(c).toMatchObject({ id: "signup-a1", handle: "pete@gmail.com", displayName: "pete@gmail.com", platform: "" });
    expect(c.signup).toEqual({ status: "TikTok nicht verbunden", at: "angemeldet", tiktok: null });
    expect(c.messages[0].body).not.toContain("tiktok.com");
    expect(c.messages[0].body).not.toContain("Land:");
  });

  it("shows a login without sign-up by its mail address", () => {
    const [c] = signupConversations([], [{ userId: "u2", email: "dra@gmail.com", signedInAt: "2026-10-21T23:25:51Z" }]);
    expect(c).toMatchObject({ id: "signup-stuck-u2", kind: "signup", handle: "dra@gmail.com", displayName: "dra@gmail.com", contactEmail: "dra@gmail.com" });
    expect(c.signup).toEqual({ status: "Formular nicht abgeschickt", at: "eingeloggt", tiktok: null });
    expect(c.messages[0].body).toContain("Eingeloggt: 22.10.26, 01:25");
  });

  it("leaves out our own test accounts", () => {
    const out = signupConversations(
      [account({ email: "klar_test_creator@getklar.org" })],
      [{ userId: "u3", email: "delivered@resend.dev", signedInAt: "2026-10-21T19:17:00Z" }],
    );
    expect(out).toEqual([]);
  });
});
