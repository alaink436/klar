// /brain — the invited-member AI-Brain viewer. The (viewer) layout has
// already proven a non-revoked membership; here we resolve the member's scope
// and hand the filtered graph to the client BrainExplorer. Note bodies load
// on demand via /brain/note (which re-checks scope server-side).

import { getSessionUser } from "@/lib/supabaseAuth";
import { getBrainMember, scopeForMember } from "@/lib/brainMembers";
import { scopeGraph } from "@/lib/brainVault";
import BrainExplorer from "@/app/components/brain/BrainExplorer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BrainPage() {
  const user = await getSessionUser();
  const member = user?.email ? await getBrainMember(user.email) : null;
  const graph = scopeGraph(scopeForMember(member));

  return (
    <BrainExplorer
      graph={graph}
      noteApi="/brain/note"
      scopeLabel="Öffne eine Notiz, um ihre Verbindungen zu sehen."
    />
  );
}
