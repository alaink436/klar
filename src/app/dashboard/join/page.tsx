// /dashboard/join: the sign-up page for people new to the creator platform, the "Sign up" of the front page (Alain
// 2026-10-22: "die Landing-Page und die Login-Seite klar unterscheiden"). It sells in three steps, side by side above
// the form on a computer, below it on a phone; returning creators sign in on the plain /dashboard/login. Both send the same e-mail link, so whoever
// lands on the wrong one still gets in. Signed-in visitors go straight on.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabaseAuth";
import AuthFrame from "../login/AuthFrame";
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
    <AuthFrame title="Get your Basalt slideshows." sub="Free, and you don't need any followers." wide>
      {/* On a phone the e-mail card comes first, so it is on the first screen; the steps follow below it. */}
      <ol className="order-last mt-9 grid w-full gap-3 sm:order-none sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step} className="rounded-2xl border border-white/70 bg-white/45 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <span className="block text-[12px] font-medium tabular-nums text-[var(--ink-3)]">0{i + 1}</span>
            <span className="mt-1.5 block text-[15px] leading-snug">{step}</span>
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
    </AuthFrame>
  );
}
