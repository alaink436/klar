// getklar.org/dashboard: the creator platform (spec Projects/Klar/specs/
// creator-plattform). Ticket 02 brought sign-up and the bio code, ticket 03 the
// kit, ticket 04 the posts with their status and the strike notices, ticket 05
// the estimate for creators without a link and the link offer from 1000
// followers, ticket 06 the payouts. A paused or closed account gets no kit, but
// is still paid what its counted posts earned.
//
// Signed out: to /dashboard/login. Signed in: straight into the dashboard (Alain
// 2026-10-22: "nach dem Mail-Link sofort das eigene Dashboard mit den Slideshows",
// "so wenig Friktion wie möglich"); the account is created on the first visit and
// gets its kit at once. Not connected yet: "Connect your TikTok" above the kit.
// Connected, not verified: the bio code. Verified: what happens next.

import { after } from "next/server";
import { redirect } from "next/navigation";
import Site from "../components/home/Site";
import { card } from "../components/home/formStyles";
import { getSessionUser } from "@/lib/supabaseAuth";
import { getAdminSettings, logNotifEvent } from "@/lib/adminSettings";
import { LINK_FOLLOWERS, creatorShortLink, ensureCreatorAccount } from "@/lib/creatorAccounts";
import { creatorEarning, latestModelRun, postEstimate } from "@/lib/creatorEarnings";
import { getCreatorKit } from "@/lib/creatorKit";
import { balances, listPayouts } from "@/lib/payouts";
import { listCreatorPosts } from "@/lib/postCheck";
import { findKlarApp } from "@/lib/klarApps";
import { flushNotifsIfBatchReady } from "@/lib/notifFlusher";
import Apps, { type AppChoiceItem } from "./Apps";
import ConnectTiktok from "./ConnectTiktok";
import Earnings from "./Earnings";
import Kit from "./Kit";
import Payouts from "./Payouts";
import Posts from "./Posts";
import VerifyStep from "./VerifyStep";

export const dynamic = "force-dynamic";
export const metadata = { title: "Creator dashboard · Klar Studios", robots: { index: false } };

// Basalt (registry slug wavelength) is the app with a kit; Kelva and Pocketmate (myloo) follow.
const APPS: AppChoiceItem[] = [
  ["wavelength", true],
  ["kelva", false],
  ["myloo", false],
].map(([slug, live]) => {
  const app = findKlarApp(slug as string);
  return { name: slug === "myloo" ? "Pocketmate" : (app?.name ?? String(slug)), icon: app?.icon ?? "", live: live as boolean };
});

export default async function CreatorDashboard({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { new: notice } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/dashboard/login");
  const ensured = await ensureCreatorAccount(user.id, user.email ?? "");
  const account = ensured?.account ?? null;
  // A new account is the sign-up: it goes into the notification digest like a website application.
  if (ensured?.created) {
    const { app_slug, email } = ensured.account;
    after(async () => {
      if (!(await getAdminSettings({ revalidate: 30 })).notification_trigger_inquiry) return;
      await logNotifEvent({ event_type: "creator_signup", app_slug, handle: null, payload: { email } });
      await flushNotifsIfBatchReady();
    });
  }
  const link = account ? await creatorShortLink(account) : null;
  const verified = account?.verified_at ? account : null;
  const paused = !!account?.suspended_until && new Date(account.suspended_until) > new Date();
  const closed = !!account?.closed_at;
  const kit = account && !paused && !closed ? await getCreatorKit(account.id) : null;
  const posts = verified ? await listCreatorPosts(verified.id) : null;
  const run = verified ? await latestModelRun() : null;
  const earning = verified && run ? await creatorEarning(verified.id, run.month) : null;
  // After switching to a link, posts counted before still earn from the estimate.
  const estimated = verified && (!verified.has_link || earning) ? verified : null;
  const [balance] = verified ? await balances(verified.id).catch(() => []) : [];
  const payouts = verified ? await listPayouts(verified.id).catch(() => []) : [];
  const estimates =
    run && posts ? new Map(posts.filter((p) => p.status === "counts" || p.status === "approved").map((p) => [p.postId, postEstimate(run, p.views)])) : undefined;

  return (
    <Site>
      <main className="mx-auto max-w-[720px] px-5 pb-24 pt-32 sm:px-8">
        <p className="text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">Creator dashboard</p>
        <h1 className="mt-4 text-[clamp(40px,6vw,64px)] font-medium leading-[0.95] tracking-[-0.05em]">
          {account?.verified_at ? `You're in, @${account.tiktok_handle}.` : "Get paid to post."}
        </h1>
        <div className="mt-6">
          <Apps apps={APPS} />
        </div>

        {!account && <p className={`${card} mt-10 text-[15px]`}>We couldn&apos;t load your dashboard. Reload the page in a moment.</p>}
        {account && !account.tiktok_handle && <ConnectTiktok />}
        {account?.tiktok_handle && !account.verified_at && <VerifyStep handle={account.tiktok_handle} code={account.bio_code} />}
        {account?.verified_at && (
          <div className={`${card} mt-10 grid gap-5 text-[15.5px] leading-relaxed`}>
            <p>We now read your TikTok posts every 6 hours.</p>
            {link ? (
              <p>
                Your link: <span className="font-medium">{link}</span>
                <br />
                <span className="text-[var(--ink-2)]">Put it in your bio. Every install through it counts exactly.</span>
              </p>
            ) : (
              <p className="text-[var(--ink-2)]">
                Without a link we estimate your share from your views and the app&apos;s sign-ups. Once you can add a
                link to your bio, it counts exactly.
              </p>
            )}
          </div>
        )}
        {verified && (closed || paused || verified.strikes > 0) && (
          <div className={`${card} mt-6 border-[#b42318]/30 text-[15px] leading-relaxed`}>
            {closed
              ? "Your account is closed after three rejected posts. We no longer read your posts; what you earned with posts that counted is still paid out."
              : paused
                ? `Your account is paused until ${new Date(verified.suspended_until!).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}. Posts in this time don't count and you get no new posts.`
                : verified.strikes >= 2
                  ? "Your pause is over. One more rejected post closes your account."
                  : "You have one warning: a post was rejected. A second rejection pauses your account for 30 days."}
          </div>
        )}
        {estimated && (
          <Earnings run={run} earning={earning} offerLink={!closed && !estimated.has_link && (estimated.followers ?? 0) >= LINK_FOLLOWERS} followers={estimated.followers ?? 0} />
        )}
        {verified && <Payouts balance={balance ?? null} payouts={payouts} />}
        {kit && <Kit kit={kit.kit} waiting={kit.waiting} notice={notice} />}
        {posts && <Posts posts={posts} estimates={estimates} />}

        <form action="/dashboard/logout" method="post" className="mt-10">
          <button type="submit" className="text-[13px] font-medium text-[var(--ink-3)] transition hover:text-[var(--ink)]">
            Sign out
          </button>
        </form>
      </main>
    </Site>
  );
}
