#!/usr/bin/env node
// Klar Affiliate Setup Skript
//
// Reads klar/scripts/affiliates-input.json (Wise-Token + per-app service-role
// keys), then for every app:
//   1. Generates a random 32-byte KLAR_APP_ADMIN_KEY.
//   2. Sets the four Wise + auth secrets in the app Supabase via
//      `supabase secrets set --project-ref <ref>`.
//   3. Deploys wise-dispatch + wise-reconcile from klar/supabase/functions/
//      via `supabase functions deploy --project-ref <ref>`.
//   4. Smoke-tests the deployed function with the new admin key.
//
// Output:
//   - klar/scripts/affiliates-output.json (gitignored): per-app admin_key +
//     functions_base + smoke result. Backup for re-runs.
//   - Stdout: the ready-to-paste KLAR_ADMIN_APPS JSON for Vercel.
//
// Pre-flight:
//   * `supabase` CLI installed and `supabase login` done once.
//   * affiliates-input.json filled with real values.

import { randomBytes } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const INPUT_PATH = resolve(__dirname, "affiliates-input.json");
const OUTPUT_PATH = resolve(__dirname, "affiliates-output.json");

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

const log = {
  step: (n, msg) => console.log(`${COLORS.cyan}${COLORS.bold}[${n}]${COLORS.reset} ${msg}`),
  ok: (msg) => console.log(`  ${COLORS.green}OK${COLORS.reset} ${msg}`),
  warn: (msg) => console.log(`  ${COLORS.yellow}WARN${COLORS.reset} ${msg}`),
  err: (msg) => console.error(`  ${COLORS.red}FAIL${COLORS.reset} ${msg}`),
  dim: (msg) => console.log(`  ${COLORS.dim}${msg}${COLORS.reset}`),
};

function die(msg) {
  log.err(msg);
  process.exit(1);
}

// 1. Pre-flight
function checkCli(name) {
  const r = spawnSync(name, ["--version"], { stdio: "pipe", shell: process.platform === "win32" });
  if (r.status !== 0) {
    die(
      `${name} CLI nicht gefunden oder nicht ausführbar. ` +
        `Installiere via 'npm install -g supabase' oder 'scoop install supabase'.`,
    );
  }
  return String(r.stdout || r.stderr).trim();
}

function readInput() {
  if (!existsSync(INPUT_PATH)) {
    die(
      `Input-Datei fehlt: ${INPUT_PATH}\n` +
        `Kopier scripts/affiliates-input.example.json zu scripts/affiliates-input.json und fülle die Werte aus.`,
    );
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(INPUT_PATH, "utf8"));
  } catch (e) {
    die(`affiliates-input.json ist kein valides JSON: ${e.message}`);
  }
  if (!raw.wise?.api_token || raw.wise.api_token.startsWith("PASTE_")) {
    die("wise.api_token in affiliates-input.json ist noch ein Platzhalter.");
  }
  if (!raw.wise?.profile_id || String(raw.wise.profile_id).startsWith("PASTE_")) {
    die("wise.profile_id in affiliates-input.json ist noch ein Platzhalter.");
  }
  if (!raw.apps || typeof raw.apps !== "object") {
    die("apps-Block in affiliates-input.json fehlt.");
  }
  for (const [slug, app] of Object.entries(raw.apps)) {
    if (!app.project_ref || !app.service_role_key) {
      die(`app '${slug}' braucht project_ref + service_role_key.`);
    }
    if (app.service_role_key.startsWith("PASTE_")) {
      die(`app '${slug}' hat service_role_key noch als Platzhalter.`);
    }
  }
  return raw;
}

// 2. Per-app actions
function setSecrets(slug, projectRef, secrets) {
  // supabase secrets set KEY=VALUE KEY=VALUE ... --project-ref <ref>
  const args = [
    "secrets",
    "set",
    ...Object.entries(secrets).map(([k, v]) => `${k}=${v}`),
    "--project-ref",
    projectRef,
  ];
  const r = spawnSync("supabase", args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    cwd: REPO_ROOT,
  });
  if (r.status !== 0) {
    log.err(`secrets set für ${slug} fehlgeschlagen`);
    log.dim(String(r.stderr || r.stdout));
    return false;
  }
  return true;
}

function deployFunction(slug, projectRef, name) {
  const args = ["functions", "deploy", name, "--project-ref", projectRef, "--no-verify-jwt"];
  const r = spawnSync("supabase", args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    cwd: REPO_ROOT,
  });
  if (r.status !== 0) {
    log.err(`deploy ${name} für ${slug} fehlgeschlagen`);
    log.dim(String(r.stderr || r.stdout));
    return false;
  }
  return true;
}

async function smokeTest(slug, projectRef, adminKey) {
  // POST a body with no batch_id; we expect 400 missing_batch_id, which
  // proves: function reachable + auth header accepted + WISE secrets present.
  const url = `https://${projectRef}.supabase.co/functions/v1/wise-dispatch`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey,
      },
      body: "{}",
    });
    const txt = await res.text();
    let body;
    try {
      body = JSON.parse(txt);
    } catch {
      body = txt;
    }
    if (res.status === 400 && body?.error === "missing_batch_id") {
      return { ok: true, note: "auth + secrets ok, function alive" };
    }
    if (res.status === 401) {
      return { ok: false, note: "401 unauthorized — admin_key mismatch?" };
    }
    if (res.status === 500 && body?.error === "wise_misconfigured") {
      return { ok: false, note: "wise secrets nicht angekommen" };
    }
    return { ok: false, note: `unerwartet ${res.status}: ${JSON.stringify(body).slice(0, 200)}` };
  } catch (e) {
    return { ok: false, note: `fetch failed: ${String(e).slice(0, 200)}` };
  }
}

// 3. Main
async function main() {
  console.log(`${COLORS.bold}Klar Affiliate Setup${COLORS.reset}`);
  console.log(`${COLORS.dim}Repo: ${REPO_ROOT}${COLORS.reset}\n`);

  log.step(1, "Pre-flight Checks");
  const v = checkCli("supabase");
  log.ok(`supabase CLI: ${v.split("\n")[0]}`);
  const input = readInput();
  const apps = Object.entries(input.apps);
  log.ok(`Input geladen: ${apps.length} Apps konfiguriert.`);
  console.log();

  const previousOutput = existsSync(OUTPUT_PATH)
    ? JSON.parse(readFileSync(OUTPUT_PATH, "utf8"))
    : { apps: {} };

  const results = {};

  for (const [slug, app] of apps) {
    log.step(`APP`, `${COLORS.bold}${slug}${COLORS.reset} (${app.project_ref})`);

    // Re-use admin_key from previous run when present, so re-runs don't
    // rotate the key and break the Vercel env that's already pasted.
    const prev = previousOutput.apps[slug];
    const adminKey = prev?.admin_key ?? randomBytes(32).toString("hex");
    if (prev?.admin_key) {
      log.dim(`admin_key wiederverwendet aus vorigem Run.`);
    } else {
      log.ok(`admin_key generiert (32 byte).`);
    }

    const secrets = {
      WISE_API_TOKEN: input.wise.api_token,
      WISE_PROFILE_ID: String(input.wise.profile_id),
      WISE_SOURCE_CURRENCY: input.wise.source_currency || "EUR",
      KLAR_APP_ADMIN_KEY: adminKey,
    };
    if (setSecrets(slug, app.project_ref, secrets)) {
      log.ok("4 Secrets in Supabase gesetzt.");
    } else {
      results[slug] = { ok: false, stage: "secrets" };
      continue;
    }

    let depOk = true;
    depOk = depOk && deployFunction(slug, app.project_ref, "wise-dispatch");
    if (depOk) log.ok("wise-dispatch deployed.");
    depOk = depOk && deployFunction(slug, app.project_ref, "wise-reconcile");
    if (depOk) log.ok("wise-reconcile deployed.");
    if (!depOk) {
      results[slug] = { ok: false, stage: "deploy", admin_key: adminKey };
      continue;
    }

    const smoke = await smokeTest(slug, app.project_ref, adminKey);
    if (smoke.ok) log.ok(`smoke: ${smoke.note}`);
    else log.warn(`smoke: ${smoke.note}`);

    results[slug] = {
      ok: smoke.ok,
      admin_key: adminKey,
      project_ref: app.project_ref,
      service_role_key: app.service_role_key,
      supabase_url: `https://${app.project_ref}.supabase.co`,
      functions_base: `https://${app.project_ref}.supabase.co/functions/v1`,
      smoke: smoke.note,
    };
    console.log();
  }

  // 4. Persist + emit Vercel JSON
  log.step(2, "Output schreiben");
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify({ generated_at: new Date().toISOString(), apps: results }, null, 2),
    "utf8",
  );
  log.ok(`scripts/affiliates-output.json geschrieben (gitignored).`);

  // App-Namen passend zum Klar Marketing-Branding
  const APP_NAMES = {
    "yarn-stash": "Yarn-Stash",
    trubel: "Trubel",
    myloo: "MyLoo",
    wavelength: "Wavelength",
    kelva: "Kelva",
    moto: "ThrottleUp",
  };

  const klarAdminApps = Object.entries(results)
    .filter(([, r]) => r.admin_key)
    .map(([slug, r]) => ({
      slug,
      name: APP_NAMES[slug] || slug,
      supabaseUrl: r.supabase_url,
      serviceKey: r.service_role_key,
      functionsBase: r.functions_base,
      adminKey: r.admin_key,
    }));

  console.log();
  log.step(3, "KLAR_ADMIN_APPS für Vercel");
  console.log(
    `\n${COLORS.dim}Kopier den folgenden JSON-String und paste ihn in${COLORS.reset}`,
  );
  console.log(
    `${COLORS.dim}Vercel klar-Projekt -> Settings -> Environment Variables -> KLAR_ADMIN_APPS:${COLORS.reset}\n`,
  );
  console.log(JSON.stringify(klarAdminApps));
  console.log();

  // Summary
  const ok = Object.values(results).filter((r) => r.ok).length;
  const failed = Object.values(results).filter((r) => !r.ok).length;
  console.log(
    `${COLORS.bold}Summary:${COLORS.reset} ${COLORS.green}${ok} ok${COLORS.reset}, ${
      failed > 0 ? COLORS.yellow + failed + " warnings" + COLORS.reset : "0 warnings"
    }`,
  );
  if (failed > 0) {
    console.log(`${COLORS.dim}Details in scripts/affiliates-output.json.${COLORS.reset}`);
  }
}

main().catch((e) => die(String(e)));
