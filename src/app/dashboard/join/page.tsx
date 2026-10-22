// /dashboard/join: the sign-up page for people new to the creator platform, the "Sign up" of the front page (Alain
// 2026-10-22: "die Landing-Page und die Login-Seite klar unterscheiden"). It sells in three steps; returning creators
// sign in on the plain /dashboard/login. Both send the same e-mail link, so whoever lands on the wrong one still gets
// in. Signed-in visitors go straight on.

import Link from "next/link";
import { redirect } from "next/navigation";
import Site from "../../components/home/Site";
import { getSessionUser } from "@/lib/supabaseAuth";
import LoginForm from "../login/LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Get your slideshows · Klar Studios", robots: { index: false } };

const STEPS = [
  "Enter your email. We send you a link, no password.",
  "Tap it: your own dashboard with slideshows ready to post.",
  "Post them on TikTok and get 50% of what they bring in.",
];

export default async function CreatorJoin() {
  if (await getSessionUser()) redirect("/dashboard");
  return (
    <Site>
      <main className="mx-auto max-w-[560px] px-5 pb-24 pt-32 sm:px-8">
        <p className="text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">For creators</p>
        <h1 className="mt-4 text-[clamp(40px,6vw,64px)] font-medium leading-[0.95] tracking-[-0.05em]">Get your Basalt slideshows.</h1>
        <p className="mt-5 max-w-[42ch] text-[17px] leading-snug text-[var(--ink-2)]">Free, and you don&apos;t need any followers.</p>
        <ol className="mt-8 space-y-4 text-[16px] leading-snug">
          {STEPS.map((step, i) => (
            <li key={step} className="grid grid-cols-[2.25rem_1fr]">
              <span className="text-[13px] tabular-nums text-[var(--ink-3)]">0{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <LoginForm expired={false} cta="Get my slideshows" />
        <p className="mt-6 text-[14px] text-[var(--ink-3)]">
          Already have an account?{" "}
          <Link href="/dashboard/login" className="font-medium text-[var(--ink)] underline decoration-[var(--hair)] underline-offset-4">
            Sign in
          </Link>
        </p>
      </main>
    </Site>
  );
}
