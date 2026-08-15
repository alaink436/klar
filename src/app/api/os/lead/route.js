import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Free-kit lead capture: email in, download path out. The download must never
// fail because the DB is down; capture is best-effort, delivery is guaranteed.
const FREE_ZIP = "/klar-os-free-v1.zip";

export async function POST(req) {
  let email = "";
  try {
    const body = await req.json();
    email = String(body.email || "").trim().toLowerCase();
  } catch {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }
  // Klar OS has its own Supabase project. Never the Klar Hub one this app
  // uses everywhere else — `leads` means something different in each.
  const url = process.env.KLAROS_SUPABASE_URL;
  const serviceKey = process.env.KLAROS_SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    try {
      const supabase = createClient(url, serviceKey);
      await supabase.from("leads").upsert({ email, source: "free_kit" }, { onConflict: "email" });
    } catch {}
  }
  return NextResponse.json({ ok: true, url: FREE_ZIP });
}
