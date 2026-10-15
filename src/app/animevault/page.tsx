// Anime Vault: app page, /animevault. The page a creator link opens on a
// computer and on Android. Layout and banners: components/landing.
//
// Film: the chrome loop from the onboarding room (Content/web-header,
// avheader-master), rings kept whole, black extended above and below; behind
// it the welcome screen with the AV mark from the iOS simulator
// (Content/logo-2026-10-14/sim). Claims stay within the App Store listing.

import AppLanding, { landingMetadata, type Landing } from "../components/landing/AppLanding";

const ANIME_VAULT: Landing = {
  id: "animevault",
  registry: "anime-vault",
  name: "Anime Vault",
  kind: "Tracker & list",
  headline: "Never miss the next episode.",
  sub: "Talk about anime, keep your list, and see on your home screen which weekday the next episode drops.",
  features: [
    {
      title: "Next episode on your home screen",
      line: "Widgets show which weekday the next episode drops, on the lock screen too. One anime per widget or your whole list.",
    },
    {
      title: "Your list, synced",
      line: "Watching, completed, planned, dropped. Check off episodes, with two-way sync to AniList and MyAnimeList.",
    },
    {
      title: "Smart Search",
      line: "Four quick questions, up to thirty matches from over 3,600 anime and donghua rated 7.0 or better.",
    },
    {
      title: "A community, free",
      line: "Five boards by season and topic, star reviews, a new daily topic. Reply, upvote, share your list.",
    },
  ],
  film: "/animevault/chrome",
  filmLabel: "Anime Vault: chrome shapes turning on black",
  screen: { src: "/animevault/screen-welcome.webp", alt: "Anime Vault welcome screen with poster wall" },
  privacy: "/animevault/privacy",
  title: "Anime Vault · Tracker & list",
  description: "Talk about anime, keep your list and never miss an episode.",
};

export const metadata = landingMetadata(ANIME_VAULT);

export default function AnimeVaultPage() {
  return <AppLanding l={ANIME_VAULT} />;
}
