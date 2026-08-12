// The social-account landscape across all Klar Studios apps.
//
// Source of truth for *which* accounts exist — including the ones Blotato has
// never seen, which is the whole point: the private niche accounts post by hand,
// so a dashboard built only from the Blotato account list cannot show them.
//
// Follower/like counts are hand-measured from the public profiles (they are not
// available through any API we hold) and therefore carry `measuredAt`. Treat
// them as a snapshot, not live data — the UI labels them as such.
//
// Mirror of AI-Brain `Projects/Klar-Content-Pipeline/SOCIAL-ACCOUNTS.md`;
// keep the two in sync when accounts are added or renamed.

export type AppKey = "animevault" | "trubel" | "kelva" | "myloo" | "basalt";
export type Platform = "tiktok" | "instagram" | "x";

/**
 * brand   — posts as the app itself
 * private — personal-looking niche account that funnels to the app
 * legacy  — superseded, kept only because it still exists
 * founder — Alain's own presence, carries all apps
 */
export type AccountRole = "brand" | "private" | "legacy" | "founder";

/** Anything that needs a human decision shows up as a flag on the node. */
export type FlagLevel = "warn" | "crit";

export interface AccountFlag {
  level: FlagLevel;
  text: string;
}

export interface SocialAccount {
  /** Without the leading @. Empty when the handle is not known yet. */
  handle: string;
  app: AppKey;
  platform: Platform;
  role: AccountRole;
  /** Profile display name, where it differs from the handle. */
  displayName?: string;
  /** Blotato account id — absent means the account can only be posted to by hand. */
  blotatoId?: string;
  followers?: number;
  likes?: number;
  /** ISO date the counts were read off the profile. */
  measuredAt?: string;
  /** Which mail alias the account logs in with (see Infrastructure/mail-aliases.md). */
  login?: string;
  flags?: AccountFlag[];
}

export interface AppMeta {
  key: AppKey;
  name: string;
  /** One line on what this app posts and how. */
  content: string;
  /** Node accent — cool palette, same family the brain graph uses. */
  color: string;
}

export const APPS: AppMeta[] = [
  {
    key: "animevault",
    name: "Anime Vault",
    content: "Foto-Carousels über Blotato, 3 Formate. Täglich 3 Drafts + Trending-Sound.",
    color: "#7BE0CD",
  },
  {
    key: "trubel",
    name: "Trubel",
    content:
      "Manuell posten. Vorproduziert: 10 Fast-Cut-TikToks + Pain-Point-Spots. Auf X Replies unter grösseren Creatorn.",
    color: "#56C6E0",
  },
  {
    key: "kelva",
    name: "Kelva",
    content: "App im Bau. Marketing über Alains Schwester. Content-Muster wie Basalt.",
    color: "#74D6C4",
  },
  {
    key: "myloo",
    name: "MyLoo",
    content: "Werbung, die wie ein privater Account aussieht. Slideshows primär, Aufhänger Widgets.",
    color: "#5E93C9",
  },
  {
    key: "basalt",
    name: "Basalt",
    content: "Ein Account, der in der Nische gut lief, dient als Vorlage — Format auf beiden privaten nachbauen.",
    color: "#6FD8A6",
  },
];

const M = "2026-08-12";

export const ACCOUNTS: SocialAccount[] = [
  // ---- Anime Vault ----
  {
    handle: "clairmentklarclear",
    app: "animevault",
    platform: "tiktok",
    role: "brand",
    blotatoId: "39338",
    followers: 1577,
    likes: 282700,
    measuredAt: M,
  },
  { handle: "clairmentklarclear", app: "animevault", platform: "instagram", role: "brand", blotatoId: "62247" },

  // ---- Trubel ----
  {
    handle: "theappforevents",
    app: "trubel",
    platform: "tiktok",
    role: "brand",
    blotatoId: "46401",
    followers: 62,
    likes: 3608,
    measuredAt: M,
  },
  {
    handle: "",
    app: "trubel",
    platform: "x",
    role: "founder",
    flags: [{ level: "warn", text: "Handle noch nicht notiert — trägt den Founder-Brand für alle Apps." }],
  },

  // ---- Kelva ----
  {
    handle: "kelvaapp",
    app: "kelva",
    platform: "tiktok",
    role: "brand",
    blotatoId: "48103",
    followers: 9310,
    likes: 38800,
    measuredAt: M,
    flags: [
      {
        level: "warn",
        text: "Bio wirbt für eine Budget-App (kelva.space/get) — der grösste Follower-Bestand zeigt ins Leere.",
      },
    ],
  },
  {
    handle: "darylbaryl8",
    app: "kelva",
    platform: "tiktok",
    role: "private",
    displayName: "darylbaryl",
    followers: 0,
    likes: 0,
    measuredAt: M,
    login: "kelvapriv@mail.getklar.org",
    flags: [{ level: "warn", text: "Keine Bio, auto-generierter Handle." }],
  },

  // ---- MyLoo ----
  {
    handle: "myloonmjihg",
    app: "myloo",
    platform: "tiktok",
    role: "private",
    displayName: "chloe",
    followers: 0,
    likes: 0,
    measuredAt: M,
    login: "myloo1@mail.getklar.org",
    flags: [{ level: "warn", text: "Keine Bio, auto-generierter Handle." }],
  },
  {
    handle: "mylooame00l",
    app: "myloo",
    platform: "tiktok",
    role: "private",
    displayName: "poppy",
    followers: 0,
    likes: 0,
    measuredAt: M,
    login: "myloo2@mail.getklar.org",
    flags: [{ level: "warn", text: "Keine Bio, auto-generierter Handle." }],
  },
  { handle: "mylooapp", app: "myloo", platform: "tiktok", role: "legacy", followers: 2, likes: 32, measuredAt: M },
  {
    handle: "myloo5675",
    app: "myloo",
    platform: "tiktok",
    role: "legacy",
    blotatoId: "52663",
    followers: 0,
    likes: 2,
    measuredAt: M,
  },
  {
    handle: "mylooapp1",
    app: "myloo",
    platform: "tiktok",
    role: "legacy",
    blotatoId: "52664",
    followers: 0,
    likes: 3,
    measuredAt: M,
  },
  { handle: "mylooapp", app: "myloo", platform: "instagram", role: "brand", blotatoId: "60384" },

  // ---- Basalt ----
  {
    handle: "wavelength176",
    app: "basalt",
    platform: "tiktok",
    role: "brand",
    blotatoId: "48101",
    followers: 0,
    likes: 0,
    measuredAt: M,
    flags: [
      { level: "warn", text: 'Bio trägt die Vor-Pivot-Positionierung ("haven\'t seen your friends in a while?").' },
    ],
  },
  {
    handle: "realone9947",
    app: "basalt",
    platform: "tiktok",
    role: "private",
    displayName: "realone",
    followers: 0,
    likes: 0,
    measuredAt: M,
    login: "basalt1@mail.getklar.org",
    flags: [{ level: "warn", text: "Keine Bio, auto-generierter Handle." }],
  },
  {
    handle: "girlysgirl78",
    app: "basalt",
    platform: "tiktok",
    role: "private",
    displayName: "girlysgirl",
    followers: 0,
    likes: 0,
    measuredAt: M,
    login: "basalt2@mail.getklar.org",
    flags: [{ level: "warn", text: "Keine Bio, auto-generierter Handle." }],
  },
  { handle: "onwavelength4", app: "basalt", platform: "instagram", role: "brand", blotatoId: "52709" },
];

export const ROLE_LABEL: Record<AccountRole, string> = {
  brand: "Brand",
  private: "Privat",
  legacy: "Alt",
  founder: "Founder",
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  x: "X",
};

/** Stable node id — handle alone collides (@mylooapp exists on two platforms). */
export const accountKey = (a: SocialAccount): string =>
  `${a.app}:${a.platform}:${a.handle || "unbenannt"}`;

export interface AccountTotals {
  followers: number;
  likes: number;
  accounts: number;
  linked: number;
}

export function totals(accounts: SocialAccount[]): AccountTotals {
  return accounts.reduce<AccountTotals>(
    (acc, a) => ({
      followers: acc.followers + (a.followers ?? 0),
      likes: acc.likes + (a.likes ?? 0),
      accounts: acc.accounts + 1,
      linked: acc.linked + (a.blotatoId ? 1 : 0),
    }),
    { followers: 0, likes: 0, accounts: 0, linked: 0 },
  );
}

/**
 * Reconcile the curated list against Blotato's live account list. Blotato is
 * authoritative for "can the pipeline post here" — an id that disappeared there
 * means the connection is gone, however the file still reads.
 *
 * Matching is by platform + lowercased username, not by id, so a reconnected
 * account (new id, same handle) is recognised rather than reported as lost.
 */
export function reconcile(
  accounts: SocialAccount[],
  live: { id: string; platform: string; username: string }[],
): SocialAccount[] {
  if (live.length === 0) return accounts;
  const byHandle = new Map(live.map((l) => [`${l.platform.toLowerCase()}:${l.username.toLowerCase()}`, l.id]));
  return accounts.map((a) => {
    if (!a.handle) return a;
    const liveId = byHandle.get(`${a.platform}:${a.handle.toLowerCase()}`);
    if (liveId === a.blotatoId) return a;
    if (liveId) return { ...a, blotatoId: liveId };
    const rest = { ...a };
    delete rest.blotatoId;
    return rest;
  });
}
