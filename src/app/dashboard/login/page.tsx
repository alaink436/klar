// /dashboard/login: sign-in for returning creators, plain on purpose (Alain 2026-10-22: landing and login clearly
// apart); new people sign up on /dashboard/join. The e-mail link (Supabase Auth of the hub, no password) signs up
// or in either way. Signed-in visitors go straight on.

import Link from "next/link";
import { redirect } from "next/navigation";
import Site from "../../components/home/Site";
import { getSessionUser } from "@/lib/supabaseAuth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · Klar Studios", robots: { index: false } };

export default async function CreatorLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getSessionUser()) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <Site>
      <main className="mx-auto max-w-[560px] px-5 pb-24 pt-32 sm:px-8">
        <p className="text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">For creators</p>
        <h1 className="mt-4 text-[clamp(40px,6vw,64px)] font-medium leading-[0.95] tracking-[-0.05em]">Welcome back.</h1>
        <p className="mt-5 max-w-[42ch] text-[17px] leading-snug text-[var(--ink-2)]">
          Sign in with your email. No password, we send you a link.
        </p>
        <LoginForm expired={error === "link"} />
        <p className="mt-6 text-[14px] text-[var(--ink-3)]">
          New here?{" "}
          <Link href="/dashboard/join" className="font-medium text-[var(--ink)] underline decoration-[var(--hair)] underline-offset-4">
            Get your slideshows
          </Link>
        </p>
      </main>
    </Site>
  );
}
