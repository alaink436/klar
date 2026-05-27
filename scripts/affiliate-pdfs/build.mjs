#!/usr/bin/env node
// Build affiliate PDFs (brief short + brief long + playbook) for 5 languages from content JSON.
//
// Usage:
//   node scripts/affiliate-pdfs/build.mjs                          # all apps, all available langs+variants
//   node scripts/affiliate-pdfs/build.mjs wavelength               # one app, all available
//   node scripts/affiliate-pdfs/build.mjs wavelength brief         # both brief variants, all langs
//   node scripts/affiliate-pdfs/build.mjs wavelength brief-short   # brief short, all langs
//   node scripts/affiliate-pdfs/build.mjs wavelength brief-short-en
//   node scripts/affiliate-pdfs/build.mjs wavelength brief-long-en
//   node scripts/affiliate-pdfs/build.mjs wavelength playbook-en
//
// Output naming:
//   affiliate-product-brief-{app}-short-{lang}.pdf      = Short Brief
//   affiliate-product-brief-{app}-long-{lang}.pdf       = Long Brief (Codebase + Attribution deep dive)
//   affiliate-playbook-{app}.pdf                        = DE Playbook (legacy no-suffix, Edge function v10 contract)
//   affiliate-playbook-{app}-{lang}.pdf                 = EN/IT/FR/ES Playbook
//   affiliate-product-brief-{app}.pdf                   = Legacy mirror of EN short brief (backward compat)

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBrief, BRIEF_VARIANTS } from './brief.mjs';
import { buildPlaybook, PLAYBOOK_LANGS } from './playbook.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const contentDir = resolve(repoRoot, 'content', 'affiliate');
const outDir = resolve(repoRoot, 'public', 'assets');

const LANGS = ['en', 'de', 'it', 'fr', 'es'];

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

function parseDocArg(arg) {
  // Accept: brief, brief-short, brief-long, brief-short-en, brief-long-en,
  //         playbook, playbook-en
  if (!arg) return { kind: null, variant: null, lang: null };
  let m = arg.match(/^(brief)(?:-(short|long))?(?:-(en|de|it|fr|es))?$/);
  if (m) return { kind: 'brief', variant: m[2] || null, lang: m[3] || null };
  m = arg.match(/^(playbook)(?:-(en|de|it|fr|es))?$/);
  if (m) return { kind: 'playbook', variant: null, lang: m[2] || null };
  throw new Error(`Unknown doc arg: ${arg}`);
}

function briefHasVariantLang(app, variant, lang) {
  if (!app.brief || !app.brief[lang]) {
    // Allow legacy flat brief as EN short fallback
    if (lang === 'en' && variant === 'short' && app.brief && app.brief.tagline) return true;
    return false;
  }
  return !!app.brief[lang][variant];
}

function playbookHasLang(app, lang) {
  return !!(app.playbook && app.playbook[lang]);
}

async function buildOne(common, app, kind, variant, lang) {
  if (kind === 'brief') {
    if (!briefHasVariantLang(app, variant, lang)) return 0;
    const bytes = await buildBrief(common, app, lang, variant);
    const out = resolve(outDir, `affiliate-product-brief-${app.app.key}-${variant}-${lang}.pdf`);
    await writeFile(out, bytes);
    console.log(`${pad(`brief-${variant}-${lang}`, 18)} -> ${out}  (${bytes.length} bytes)`);
    // Legacy mirror: EN short → no-suffix file for backward compat with older Drive links.
    if (lang === 'en' && variant === 'short') {
      const legacy = resolve(outDir, `affiliate-product-brief-${app.app.key}.pdf`);
      await writeFile(legacy, bytes);
      console.log(`${pad('  └ legacy mirror', 18)} -> ${legacy}`);
      return 2;
    }
    return 1;
  }
  if (kind === 'playbook') {
    if (!playbookHasLang(app, lang)) return 0;
    const bytes = await buildPlaybook(common, app, lang);
    const out = lang === 'de'
      ? resolve(outDir, `affiliate-playbook-${app.app.key}.pdf`)
      : resolve(outDir, `affiliate-playbook-${app.app.key}-${lang}.pdf`);
    await writeFile(out, bytes);
    console.log(`${pad(`playbook-${lang}`, 18)} -> ${out}  (${bytes.length} bytes)`);
    return 1;
  }
  throw new Error(`Unknown kind ${kind}`);
}

async function main() {
  const [, , appArg, docArg] = process.argv;
  const parsed = parseDocArg(docArg);
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

    const kinds = parsed.kind ? [parsed.kind] : ['brief', 'playbook'];
    const langs = parsed.lang ? [parsed.lang] : LANGS;

    for (const kind of kinds) {
      if (kind === 'brief') {
        const variants = parsed.variant ? [parsed.variant] : BRIEF_VARIANTS;
        for (const variant of variants) {
          for (const lang of langs) {
            count += await buildOne(common, app, 'brief', variant, lang);
          }
        }
      } else {
        for (const lang of langs) {
          count += await buildOne(common, app, 'playbook', null, lang);
        }
      }
    }
  }
  console.log(`\n${count} PDF(s) written.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
