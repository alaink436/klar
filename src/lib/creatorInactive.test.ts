import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/vault", () => ({ getForProxy: async () => null }));
const mails: Array<[string, string, string]> = [];
vi.mock("./creatorMail", async (orig) => ({
  ...(await orig<typeof import("./creatorMail")>()),
  sendCreatorMail: async (to: string, mail: { subject: string; text: string }) => {
    mails.push([to, mail.subject, mail.text]);
  },
}));

import { inactiveStep, runInactiveCreators, type InactiveAccount } from "./creatorInactive";

const DAY = 86_400_000;
// the cron's run on Thursday 29 October 2026, 04:30 UTC
const NOW = Date.parse("2026-10-29T04:30:00Z");
const ago = (days: number, hour = 12) => new Date(Date.parse(`2026-10-29T${String(hour).padStart(2, "0")}:00:00Z`) - days * DAY).toISOString();
const account = (o: Partial<InactiveAccount> = {}): InactiveAccount => ({
  id: "a1",
  email: "lisa@example.com",
  tiktok_handle: "lisa",
  created_at: ago(7),
  suspended_until: null,
  inactive_warned_at: null,
  ...o,
});

describe("inactiveStep", () => {
  it("warns on the seventh calendar day after sign-up, not before", () => {
    expect(inactiveStep(account({ created_at: ago(6, 1) }), null, NOW)).toBeNull();
    expect(inactiveStep(account({ created_at: ago(7, 23) }), null, NOW)).toBe("warn");
  });

  it("closes three days after the warning, not before", () => {
    expect(inactiveStep(account({ created_at: ago(30), inactive_warned_at: ago(2, 4) }), null, NOW)).toBeNull();
    expect(inactiveStep(account({ created_at: ago(30), inactive_warned_at: ago(3, 4) }), null, NOW)).toBe("close");
  });

  it("starts over with a counted post, also one after the warning", () => {
    expect(inactiveStep(account({ created_at: ago(30) }), ago(3), NOW)).toBeNull();
    expect(inactiveStep(account({ created_at: ago(30), inactive_warned_at: ago(3, 4) }), ago(1), NOW)).toBeNull();
    expect(inactiveStep(account({ created_at: ago(30), inactive_warned_at: ago(20, 4) }), ago(8), NOW)).toBe("warn");
  });

  it("leaves a paused creator alone and counts from the end of the pause", () => {
    expect(inactiveStep(account({ created_at: ago(60), suspended_until: ago(-5) }), null, NOW)).toBeNull();
    expect(inactiveStep(account({ created_at: ago(60), suspended_until: ago(2) }), null, NOW)).toBeNull();
    expect(inactiveStep(account({ created_at: ago(60), suspended_until: ago(7) }), null, NOW)).toBe("warn");
  });
});

describe("runInactiveCreators", () => {
  const patches: Array<{ url: string; body: Record<string, unknown> }> = [];
  let failPatch = false;
  beforeEach(() => {
    patches.length = 0;
    mails.length = 0;
    failPatch = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          patches.push({ url, body: JSON.parse(String(init.body)) });
          return new Response(null, { status: failPatch ? 500 : 204 });
        }
        if (url.includes("klar_creator_accounts?closed_at=is.null")) {
          return new Response(
            JSON.stringify([
              account({ id: "a1", email: "new@example.com", tiktok_handle: "newbie", created_at: ago(7) }),
              account({ id: "a2", email: "quiet@example.com", tiktok_handle: "quiet", created_at: ago(20), inactive_warned_at: ago(3, 4) }),
              account({ id: "a3", email: "busy@example.com", tiktok_handle: "busy", created_at: ago(20) }),
              account({ id: "a4", email: "gone@example.com", tiktok_handle: "gone", created_at: ago(30) }),
            ]),
          );
        }
        if (url.includes("klar_post_checks?status=in.(counts,approved,link)")) {
          return new Response(JSON.stringify([{ creator_id: "a3", checked_at: ago(2) }, { creator_id: "a4", checked_at: ago(9) }, { creator_id: "a4", checked_at: ago(12) }]));
        }
        return new Response("[]");
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("warns the ones a week without a post, closes the warned ones and stops reading them", async () => {
    expect(await runInactiveCreators(NOW)).toEqual({ warned: ["newbie", "gone"], closed: ["quiet"] });

    expect(patches.find((p) => p.url.includes("id=eq.a1"))?.body).toEqual({ inactive_warned_at: new Date(NOW).toISOString() });
    expect(patches.find((p) => p.url.includes("id=eq.a2"))?.body).toEqual({ closed_at: new Date(NOW).toISOString(), closed_reason: "inactive" });
    expect(patches.find((p) => p.url.includes("klar_view_accounts"))).toMatchObject({ url: expect.stringContaining("handle=eq.quiet&source=eq.creator"), body: { active: false } });
    expect(patches.some((p) => p.url.includes("id=eq.a3"))).toBe(false);

    const [first, closed, gone] = mails;
    expect(first.slice(0, 2)).toEqual(["new@example.com", "Your slideshows are waiting"]);
    expect(first[2]).toContain("you signed up a week ago");
    expect(first[2]).toContain("Post one by Saturday 31 October"); // closed in Sunday's run, 1 November
    expect(gone[2]).toContain("it's been a week since your last slideshow");
    expect(closed.slice(0, 2)).toEqual(["quiet@example.com", "Your account is closed"]);
  });

  it("sends nothing when the stamp didn't save, so nobody gets a mail every morning", async () => {
    failPatch = true;
    expect(await runInactiveCreators(NOW)).toEqual({ warned: [], closed: [] });
    expect(mails).toEqual([]);
  });
});
