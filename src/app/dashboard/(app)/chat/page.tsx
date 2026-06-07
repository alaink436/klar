// Affiliate chat: message Alain directly from inside the dashboard. Server
// loads the existing thread, the client polls + sends. Alain reads and replies
// from /admin/inbox (affiliate-chat conversation kind).

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabaseAuth";
import { loadAffiliate } from "../_shared/dashboard-data";
import { listAffiliateMessages } from "@/lib/affiliateChatStore";
import { PageHeader } from "../_shared/ui";
import { ChatClient } from "./ChatClient";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await getSessionUser();
  if (!user) redirect("/dashboard/login");
  const affiliate = await loadAffiliate(user.id);
  if (!affiliate) redirect("/dashboard");

  const messages = await listAffiliateMessages(user.id);
  const initial = messages.map((m) => ({
    id: m.id,
    direction: m.direction,
    body: m.body,
    at: m.created_at,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Chat"
        title={<>Talk to <i style={{ fontFamily: "var(--font-editorial, serif)" }}>Alain.</i></>}
        intro="Questions about payouts, content ideas, or your link? Message me directly. I read every message and reply personally, usually within a day."
      />
      <ChatClient initial={initial} />
    </>
  );
}
