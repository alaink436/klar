import { describe, expect, it } from "vitest";
import { postLine } from "./creatorPosts";

const signedUp = "2026-10-22T13:32:44+00:00";

describe("postLine", () => {
  it("says 0 when nothing came since the sign-up, and leaves out posts from before", () => {
    expect(postLine(signedUp, [])).toBe("0 Posts seit Anmeldung");
    expect(postLine(signedUp, [{ status: "no_mention", postedAt: "2026-10-21T22:22:35+00:00" }])).toBe("0 Posts seit Anmeldung");
  });

  it("counts our slideshows, the review list and the last post in Swiss time", () => {
    expect(
      postLine(signedUp, [
        { status: "no_mention", postedAt: "2026-10-21T18:09:40+00:00" },
        { status: "no_mention", postedAt: "2026-10-22T18:43:58+00:00" },
      ]),
    ).toBe("1 Post seit Anmeldung · 0 davon unsere Slideshows · zuletzt 22.10., 20:43");
    expect(
      postLine(signedUp, [
        { status: "counts", postedAt: "2026-10-23T08:00:00+00:00" },
        { status: "approved", postedAt: "2026-10-23T09:00:00+00:00" },
        { status: "review", postedAt: "2026-10-23T07:00:00+00:00" },
      ]),
    ).toBe("3 Posts seit Anmeldung · 2 davon unsere Slideshows · 1 auf der Prüfliste · zuletzt 23.10., 11:00");
  });
});
