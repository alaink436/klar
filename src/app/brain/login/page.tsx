// /brain/login — magic-link entry for invited AI-Brain members. Lives outside
// the /brain layout gate (that gate would bounce an unauthenticated visitor
// straight back here). ?error=no_access is shown when a signed-in user has no
// active membership.

import { BrainLoginForm } from "./BrainLoginForm";

export const dynamic = "force-dynamic";

export default async function BrainLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return <BrainLoginForm noAccess={sp.error === "no_access"} />;
}
