// Creator sign-ups from getklar.org/dashboard as entries of the mailbox
// (Bewerbungen and Inbox, filter "Anfragen"): who sent the sign-up form, and who
// signed in but never sent it. Until 2026-10-22 they sat in a card above the
// list, next to a list saying "Keine Konversationen" (Alain: "mach das so, dass
// das auch richtig ersichtlich ist").

import type { Conversation } from "./MailClient";
import type { AccountStatus, CreatorAccount, UnfinishedSignup } from "@/lib/creatorAccounts";

const STATUS: Record<AccountStatus, string> = {
  unconnected: "TikTok nicht verbunden",
  waiting: "wartet auf Bio-Code",
  verified: "bestätigt",
  paused: "pausiert",
  closed: "geschlossen",
};

// Basalt's slug in KLAR_APPS (badge with icon); the creator platform itself says "basalt".
const BASALT = "wavelength";

const when = (iso: string) =>
  new Date(iso).toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

// Own test accounts stay out, like the test inquiries.
const isTest = (email: string) => email.startsWith("klar_test") || email.endsWith("@resend.dev");

export function signupConversations(
  accounts: Array<CreatorAccount & { status: AccountStatus }>,
  unfinished: UnfinishedSignup[],
  /** lib/postCheck creatorPostLines, by account id. */
  postLines?: Map<string, string>,
): Conversation[] {
  const signedUp = accounts
    .filter((a) => !isTest(a.email))
    .map((a): Conversation => {
      const status = STATUS[a.status];
      // Since 2026-10-22 the account exists from the first login, before a TikTok is connected.
      const handle = a.tiktok_handle;
      const body = [
        handle ? "Hat sich auf getklar.org als Creator angemeldet." : "Hat sich auf getklar.org eingeloggt und sieht seine Slideshows, TikTok noch nicht verbunden.",
        "",
        `Status: ${status}${a.status === "waiting" ? ` (der Code ${a.bio_code} fehlt noch in der TikTok-Bio)` : ""}`,
        ...(handle ? [`TikTok: tiktok.com/@${handle}`] : []),
        ...(a.country ? [`Land: ${a.country}`] : []),
        ...(handle ? [`Link in der Bio: ${a.has_link ? "ja" : "nein"}`] : []),
        `E-Mail: ${a.email}`,
        `Angemeldet: ${when(a.created_at)}`,
      ].join("\n");
      return {
        id: `signup-${a.id}`,
        handle: handle ?? a.email,
        displayName: handle ? null : a.email,
        platform: handle ? "tiktok" : "",
        contactEmail: a.email,
        language: "en",
        apps: [BASALT],
        status: a.status,
        messages: [{ id: `signup-${a.id}-form`, direction: "in", subject: null, body, at: a.created_at, provider: "dashboard" }],
        replyCount: 0,
        lastInboundAt: a.created_at,
        lastActivityAt: a.created_at,
        kind: "signup",
        signup: { status, at: "angemeldet", tiktok: handle ? `https://www.tiktok.com/@${handle}` : null, posts: postLines?.get(a.id) },
      };
    });
  const stuck = unfinished
    .filter((u) => !isTest(u.email))
    .map((u): Conversation => ({
      id: `signup-stuck-${u.userId}`,
      handle: u.email,
      displayName: u.email,
      platform: "",
      contactEmail: u.email,
      language: "en",
      apps: [BASALT],
      status: "stuck",
      messages: [
        {
          id: `signup-stuck-${u.userId}-login`,
          direction: "in",
          subject: null,
          body: [
            "Hat sich auf getklar.org eingeloggt, das Anmeldeformular aber nicht abgeschickt.",
            "",
            `E-Mail: ${u.email}`,
            `Eingeloggt: ${when(u.signedInAt)}`,
          ].join("\n"),
          at: u.signedInAt,
          provider: "dashboard",
        },
      ],
      replyCount: 0,
      lastInboundAt: u.signedInAt,
      lastActivityAt: u.signedInAt,
      kind: "signup",
      signup: { status: "Formular nicht abgeschickt", at: "eingeloggt", tiktok: null },
    }));
  return [...signedUp, ...stuck];
}
