// GET /api/routines: the daily post routines as set in Klar Control (/admin/routinen), for the cloud routines in the
// vault (Projects/Klar-Content-Pipeline/TAGESROUTINE.md, step 2). Answers every routine's posting times, credits and
// whether it is on.
//
// Auth: the vault:use token the routines already carry for Blotato and Higgsfield (Bearer). That token can do more
// than read this list, so a scope of its own would protect nothing; see lib/routineAuth.

import { routineCaller } from "@/lib/routineAuth";
import { listRoutines } from "@/lib/routines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const denied = await routineCaller(req);
  if (denied) return denied;
  const routines = await listRoutines();
  return Response.json({
    routines: routines.map((r) => ({
      app: r.app_slug,
      active: r.active,
      slots: r.slots,
      posts_per_day: r.slots.length,
      credits: r.credits,
      accounts: r.accounts,
      run_at: r.run_at,
      updated_at: r.updated_at,
    })),
  });
}
