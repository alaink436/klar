import { redirect } from "next/navigation";
import { getSessionUser, serviceSupabase } from "@/lib/supabaseAuth";
import { CancelForm } from "./CancelForm";

export const dynamic = "force-dynamic";

export default async function CancelPage() {
  const user = await getSessionUser();
  if (!user) redirect("/dashboard/login");

  const svc = serviceSupabase();
  const { data: row } = await svc
    .from("klar_affiliates")
    .select("display_name, apps, status")
    .eq("user_id", user.id)
    .maybeSingle();

  const data = row as { display_name: string | null; apps: string[]; status: string } | null;
  if (!data || data.status === "cancelled") redirect("/dashboard");

  return <CancelForm displayName={data.display_name} apps={data.apps} />;
}
