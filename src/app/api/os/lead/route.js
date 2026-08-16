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
  // Capture is best-effort, delivery is not: whatever happens below, the
  // download link goes back. But "best-effort" used to mean an empty catch,
  // which turned a broken key into a silent, permanent loss of every lead. It
  // is reported now, in the log and in the payload, without ever failing the
  // request.
  let stored = false;
  if (url && serviceKey) {
    const supabase = createClient(url, serviceKey);
    try {
      const { error } = await supabase
        .from("leads")
        .upsert({ email, source: "free_kit" }, { onConflict: "email" });
      if (error) console.error("[os/lead] upsert failed:", error.message);
      stored = !error;
    } catch (e) {
      console.error("[os/lead] upsert threw:", String(e).slice(0, 200));
    }
  } else {
    console.error("[os/lead] no KLAROS_SUPABASE_* env, lead not captured");
  }
  return NextResponse.json({ ok: true, url: FREE_ZIP, stored });
}
