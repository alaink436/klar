// getklar.org/dashboard: the creator platform (spec Projects/Klar/specs/
// creator-plattform). Ticket 02 brought sign-up and the bio code, ticket 03 the
// kit, ticket 04 the posts with their status and the strike notices; the
// numbers (ticket 05) come into the verified view later. A paused or closed
// account gets no kit.
//
// Signed out: to /dashboard/login. Signed in without an account: sign-up form.
// Account without a verified bio: the bio code. Verified: what happens next.

import { redirect } from "next/navigation";
import Site from "../components/home/Site";
import { card } from "../components/home/formStyles";
import { getSessionUser } from "@/lib/supabaseAuth";
import { creatorShortLink, getCreatorAccount } from "@/lib/creatorAccounts";
import { getCreatorKit } from "@/lib/creatorKit";
import { listCreatorPosts } from "@/lib/postCheck";
import Kit from "./Kit";
import Posts from "./Posts";
import SignupForm from "./SignupForm";
import VerifyStep from "./VerifyStep";

export const dynamic = "force-dynamic";
export const metadata = { title: "Creator dashboard · Klar Studios", robots: { index: false } };

export default async function CreatorDashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/dashboard/login");
  const account = await getCreatorAccount(user.id);
  const link = account ? await creatorShortLink(account) : null;
  const verified = account?.verified_at ? account : null;
  const paused = !!verified?.suspended_until && new Date(verified.suspended_until) > new Date();
  const closed = !!verified?.closed_at;
  const kit = verified && !paused && !closed ? await getCreatorKit(verified.id) : null;
  const posts = verified ? await listCreatorPosts(verified.id) : null;

  return (
    <Site>
      <main className="mx-auto max-w-[720px] px-5 pb-24 pt-32 sm:px-8">
        <p className="text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">Creator dashboard</p>
        <h1 className="mt-4 text-[clamp(40px,6vw,64px)] font-medium leading-[0.95] tracking-[-0.05em]">
          {account?.verified_at ? `You're in, @${account.tiktok_handle}.` : "Post about Basalt. Get paid."}
        </h1>

        {!account && <SignupForm email={user.email ?? ""} />}
        {account && !account.verified_at && <VerifyStep handle={account.tiktok_handle} code={account.bio_code} />}
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
                Without a link we estimate your share from your views and Basalt&apos;s sign-ups. Once you can add a
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
                ? `Your account is paused until ${new Date(verified.suspended_until!).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}. Posts in this time don't count and you get no new slideshows.`
                : verified.strikes >= 2
                  ? "Your pause is over. One more rejected post closes your account."
                  : "You have one warning: a post was rejected. A second rejection pauses your account for 30 days."}
          </div>
        )}
        {kit && <Kit kit={kit.kit} waiting={kit.waiting} />}
        {posts && <Posts posts={posts} />}

        <form action="/dashboard/logout" method="post" className="mt-10">
          <button type="submit" className="text-[13px] font-medium text-[var(--ink-3)] transition hover:text-[var(--ink)]">
            Sign out
          </button>
        </form>
      </main>
    </Site>
  );
}
