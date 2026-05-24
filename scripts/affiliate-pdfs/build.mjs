#!/usr/bin/env node
// Build affiliate PDFs (brief + playbook EN + playbook DE) from content JSON.
//
// Usage:
//   node scripts/affiliate-pdfs/build.mjs              # all apps
//   node scripts/affiliate-pdfs/build.mjs wavelength   # one app
//   node scripts/affiliate-pdfs/build.mjs wavelength brief
//   node scripts/affiliate-pdfs/build.mjs wavelength playbook-en
//
// Writes to klar/public/assets/affiliate-{kind}-{app}[-en].pdf

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBrief } from './brief.mjs';
import { buildPlaybook } from './playbook.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const contentDir = resolve(repoRoot, 'content', 'affiliate');
const outDir = resolve(repoRoot, 'public', 'assets');

async function loadJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function listApps() {
  const files = await readdir(contentDir);
  return files
    .filter((f) => f.endsWith('.json') && f !== 'common.json')
    .map((f) => basename(f, extname(f)));
}

function pad(s, n) { return (s + ' '.repeat(n)).slice(0, n); }

async function main() {
  const [, , appArg, docArg] = process.argv;
  const common = await loadJson(resolve(contentDir, 'common.json'));
  const apps = appArg ? [appArg] : await listApps();

  let count = 0;
  for (const appKey of apps) {
    const appPath = resolve(contentDir, `${appKey}.json`);
    let app;
    try {
      app = await loadJson(appPath);
    } catch (e) {
      console.error(`skip ${appKey}: ${e.message}`);
      continue;
    }

    const want = (kind) => !docArg || docArg === kind;

    if (want('brief')) {
      const bytes = await buildBrief(common, app);
      const out = resolve(outDir, `affiliate-product-brief-${appKey}.pdf`);
      await writeFile(out, bytes);
      console.log(`${pad('brief', 12)} -> ${out}  (${bytes.length} bytes)`);
      count++;
    }
    if (want('playbook-en')) {
      const bytes = await buildPlaybook(common, app, 'en');
      const out = resolve(outDir, `affiliate-playbook-${appKey}-en.pdf`);
      await writeFile(out, bytes);
      console.log(`${pad('playbook-en', 12)} -> ${out}  (${bytes.length} bytes)`);
      count++;
    }
    if (want('playbook-de')) {
      const bytes = await buildPlaybook(common, app, 'de');
      const out = resolve(outDir, `affiliate-playbook-${appKey}.pdf`);
      await writeFile(out, bytes);
      console.log(`${pad('playbook-de', 12)} -> ${out}  (${bytes.length} bytes)`);
      count++;
    }
  }
  console.log(`\n${count} PDF(s) written.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
