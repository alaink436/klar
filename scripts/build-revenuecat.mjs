#!/usr/bin/env node
// Builds the KLAR_REVENUECAT_KEYS env value from scripts/revenuecat-input.json.
//
// Reads the per-app projectId + secretKey you filled into revenuecat-input.json,
// drops any app still on a PASTE_ placeholder (or empty), and writes the
// ready-to-paste JSON array to scripts/klar-revenuecat-vercel.json (gitignored).
// Paste that file's content into Vercel env KLAR_REVENUECAT_KEYS.
//
// Slugs must match the Klar app slugs (lib/klarApps + lib/revenuecat getRcConfigs):
// trubel, myloo, wavelength, yarn-stash, kelva, moto, promillio.
//
// Run:  node scripts/build-revenuecat.mjs

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const IN = resolve(__dirname, "revenuecat-input.json");
const OUT = resolve(__dirname, "klar-revenuecat-vercel.json");

if (!existsSync(IN)) {
  console.error(`FAIL: ${IN} fehlt.`);
  process.exit(1);
}

let raw;
try {
  raw = JSON.parse(readFileSync(IN, "utf8"));
} catch (e) {
  console.error(`FAIL: revenuecat-input.json ist kein valides JSON: ${e.message}`);
  process.exit(1);
}

const apps = raw.apps || {};
const out = [];
const skipped = [];
const warn = [];

for (const [slug, v] of Object.entries(apps)) {
  const pid = String((v && v.projectId) || "").trim();
  const sk = String((v && v.secretKey) || "").trim();
  const filled = pid && sk && !pid.startsWith("PASTE_") && !sk.startsWith("PASTE_");
  if (!filled) {
    skipped.push(slug);
    continue;
  }
  if (!sk.startsWith("sk_")) {
    warn.push(`${slug}: secretKey faengt nicht mit 'sk_' an — sicher ein v2 Secret-Key?`);
  }
  out.push({ slug, projectId: pid, secretKey: sk });
}

writeFileSync(OUT, JSON.stringify(out));

console.log(`KLAR_REVENUECAT_KEYS gebaut: ${out.length} App(s) -> ${out.map((o) => o.slug).join(", ") || "(keine)"}`);
if (skipped.length) console.log(`Uebersprungen (kein/Platzhalter-Key): ${skipped.join(", ")}`);
for (const w of warn) console.log(`WARN ${w}`);
console.log(`Datei: scripts/klar-revenuecat-vercel.json (gitignored). Inhalt komplett in Vercel -> KLAR_REVENUECAT_KEYS einfuegen.`);
if (out.length === 0) {
  console.log(`Hinweis: noch keine App ausgefuellt -> nichts einzutragen. RevenueCat kannst du auch spaeter nachziehen.`);
}
