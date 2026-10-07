// Rundgang: requests every Klar Control page signed in and lists path + status.
//
//   npm run build && KLAR_INBOX_SERVICE_KEY=rundgang-dummy npx next start -p 3100
//   npm run rundgang -- --port 3100 --gone /admin/cal,/admin/mycakeday
//
// The dummy key keeps /admin/inbox from throwing where .env.local has none;
// its data calls then fail and the page renders empty.
//
// Pages are discovered from src/app/admin/**/page.tsx. The two cookies are
// issued here the way /admin/login/submit issues them (klar_admin = admin key,
// klar_device = signed with KLAR_DEVICE_SECRET via lib/deviceCookie), from
// .env.local. Their values are never printed. Every page must answer 200,
// every --gone path 404; otherwise the exit code is 1.

import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { newDeviceId, signDeviceCookie } from "../src/lib/deviceCookie.ts";

// Known values for dynamic segments. Pages with any other dynamic segment are skipped.
const FILL = { app: "kelva" };

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { values: args } = parseArgs({
  options: { port: { type: "string", default: "3100" }, gone: { type: "string", default: "" } },
});

process.loadEnvFile(join(root, ".env.local"));
const KEY = process.env.KLAR_ADMIN_KEY ?? "";
const DEVICE_SECRET = process.env.KLAR_DEVICE_SECRET ?? "";
if (!KEY || !DEVICE_SECRET) {
  console.error("KLAR_ADMIN_KEY and KLAR_DEVICE_SECRET must be set in .env.local");
  process.exit(2);
}

const device = await signDeviceCookie(
  { deviceId: newDeviceId(), name: "Rundgang", issuedAt: Math.floor(Date.now() / 1000) },
  DEVICE_SECRET,
);
const cookie = `klar_admin=${encodeURIComponent(KEY)}; klar_device=${encodeURIComponent(device)}`;

const pages = [];
const skipped = [];
for (const file of readdirSync(join(root, "src/app/admin"), { recursive: true })) {
  const parts = file.split(/[\\/]/);
  if (parts.pop() !== "page.tsx" || parts.some((p) => p.startsWith("_"))) continue;
  const segs = parts.filter((p) => !/^\(.*\)$/.test(p));
  const filled = segs.map((s) => {
    const name = s.match(/^\[(.+)\]$/)?.[1];
    return name ? FILL[name] : s;
  });
  if (filled.includes(undefined)) skipped.push(`/admin/${segs.join("/")}`);
  else pages.push(`/admin/${filled.join("/")}`.replace(/\/$/, ""));
}
pages.sort();
const gone = args.gone.split(",").map((p) => p.trim()).filter(Boolean);

// The admin pages stream (admin/loading.tsx), so the 200 is sent before the
// page has rendered. A redirect(), notFound() or a thrown error then only
// shows up in the body, as the digest of a React error: data-dgst (boundary
// failed before the flush), $RX(...) (failed after it) or an E row in the
// RSC payload.
function streamedStatus(html) {
  const digests = [
    ...html.matchAll(/data-dgst="([^"]+)"|\$RX\("[^"]*","([^"]+)"|E\{\\"digest\\":\\"([^"\\]+)/g),
  ].map((m) => m[1] ?? m[2] ?? m[3]);
  const error = digests.find((d) => !d.startsWith("NEXT_"));
  if (error) return [500, `Fehler beim Rendern, digest ${error}`];
  const redirect = digests.map((d) => d.match(/^NEXT_REDIRECT;\w+;([^;]+);(\d+)/)).find(Boolean);
  if (redirect) return [Number(redirect[2]), redirect[1]];
  const fallback = digests.map((d) => d.match(/^NEXT_HTTP_ERROR_FALLBACK;(\d+)/)).find(Boolean);
  if (fallback) return [Number(fallback[1]), ""];
  return [200, ""];
}

const rows = [];
for (const [path, want] of [...pages.map((p) => [p, 200]), ...gone.map((p) => [p, 404])]) {
  let status;
  let note = "";
  try {
    const res = await fetch(`http://localhost:${args.port}${path}`, {
      headers: { cookie },
      redirect: "manual",
      signal: AbortSignal.timeout(120_000),
    });
    status = res.status;
    note = res.headers.get("location") ?? "";
    if (status === 200) [status, note] = streamedStatus(await res.text());
  } catch (e) {
    status = "-";
    note = e.cause?.code ?? e.name;
  }
  rows.push({ path, want, status, note, ok: status === want });
}

const w = Math.max(...rows.map((r) => r.path.length));
for (const r of rows) {
  console.log(`${r.ok ? "  " : "!!"} ${r.path.padEnd(w)}  ${String(r.status).padEnd(3)}  (soll ${r.want})  ${r.note}`);
}
for (const s of skipped) console.log(`   ${s.padEnd(w)}  übersprungen (dynamisches Segment)`);
const bad = rows.filter((r) => !r.ok).length;
console.log(`\n${rows.length - bad}/${rows.length} wie erwartet`);
process.exit(bad ? 1 : 0);
