// /dashboard/login: sign-in for returning creators, plain on purpose (Alain 2026-10-22: landing and login clearly
// apart); new people sign up on /dashboard/join. The e-mail link (Supabase Auth of the hub, no password) signs up
// or in either way. Signed-in visitors go straight on.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabaseAuth";
import AuthFrame from "./AuthFrame";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · Klar Studios", robots: { index: false } };

export default async function CreatorLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getSessionUser()) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <AuthFrame title="Welcome back." sub="Sign in with your email. No password, we send you a link.">
      <LoginForm expired={error === "link"} />
      <p className="mt-6 text-[14px] text-[var(--ink-3)]">
        New here?{" "}
        <Link href="/dashboard/join" className="font-medium text-[var(--ink)] underline decoration-[var(--hair)] underline-offset-4">
          Get your slideshows
        </Link>
      </p>
    </AuthFrame>
  );
}
