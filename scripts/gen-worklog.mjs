/**
 * Worklog timeline generator (the "Zeitraffer" data).
 *
 * Scans the local working trees of the 6 app repos + the AI-Brain Obsidian
 * vault, reads every commit date via git, buckets them into ISO weeks, and
 * writes src/app/data/worklog.json. Same philosophy as codebase.json:
 * real numbers from the actual repos, build-baked, no API / no secret.
 *
 * Run manually after substantial repo activity:
 *   node scripts/gen-worklog.mjs
 */
import { execSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOME = "C:\\Users\\Alain Kessler";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "app", "data", "worklog.json");

/** slug -> local repo path. wavelength ships from the Thinq tree. */
const APP_REPOS = {
  trubel: "Trubel",
  myloo: "MyLoo",
  wavelength: "Thinq",
  "yarn-stash": "Yarn-Stash",
  kelva: "universal-life-hub",
  moto: "Moto-Maintenance",
};
const BRAIN_REPO = "AI-Brain";

const git = (repo, args) =>
  execSync(`git -C "${join(HOME, repo)}" ${args}`, { encoding: "utf8" });

/** all commit dates (YYYY-MM-DD), including merges, to match rev-list count */
function commitDates(repo) {
  return git(repo, "log --format=%ad --date=short")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Monday of the ISO week containing `iso` (YYYY-MM-DD) */
function weekStart(iso) {
  const d = new Date(iso + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

function addWeeks(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

/** recursively count *.md files, skipping .git */
function countMd(dir) {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === ".git" || e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) n += countMd(p);
    else if (e.name.endsWith(".md")) n++;
  }
  return n;
}

function countProjectDirs(brainPath) {
  const projects = join(brainPath, "Projects");
  return readdirSync(projects, { withFileTypes: true }).filter((e) =>
    e.isDirectory()
  ).length;
}

// ── collect ──────────────────────────────────────────────────────────────
const appDates = [];
const repoSummary = [];
for (const [slug, repo] of Object.entries(APP_REPOS)) {
  const ds = commitDates(repo);
  appDates.push(...ds);
  repoSummary.push({ slug, commits: ds.length, first: ds[ds.length - 1] });
}
const brainDates = commitDates(BRAIN_REPO);

const allDates = [...appDates, ...brainDates].sort();
const first = weekStart(allDates[0]);
const lastCommit = allDates[allDates.length - 1];
const today = new Date().toISOString().slice(0, 10);
const lastWeek = weekStart(today);

// ── weekly buckets ───────────────────────────────────────────────────────
const bucket = new Map(); // week -> { apps, brain }
for (let w = first; w <= lastWeek; w = addWeeks(w, 1))
  bucket.set(w, { apps: 0, brain: 0 });
for (const d of appDates) bucket.get(weekStart(d)).apps++;
for (const d of brainDates) bucket.get(weekStart(d)).brain++;

let cum = 0;
let peak = { w: first, total: 0 };
const weeks = [...bucket.entries()].map(([w, v]) => {
  const total = v.apps + v.brain;
  cum += total;
  if (total > peak.total) peak = { w, total };
  return { w, apps: v.apps, brain: v.brain, total, cum };
});

const activeDays = new Set(allDates).size;
const spanDays =
  Math.round(
    (new Date(today) - new Date(allDates[0])) / 86400000
  ) + 1;

const brainPath = join(HOME, BRAIN_REPO);
const data = {
  generated: today,
  first: allDates[0],
  last: lastCommit,
  weeks,
  repos: repoSummary.sort((a, b) => b.commits - a.commits),
  totals: {
    appCommits: appDates.length,
    brainCommits: brainDates.length,
    totalCommits: allDates.length,
    brainNotes: countMd(brainPath),
    projects: countProjectDirs(brainPath),
    activeDays,
    spanDays,
    peakWeek: peak,
  },
};

writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
console.log(
  `worklog.json: ${weeks.length} weeks, ${data.totals.totalCommits} commits ` +
    `(${data.totals.appCommits} app + ${data.totals.brainCommits} brain), ` +
    `${data.totals.activeDays}/${data.totals.spanDays} active days, ` +
    `${data.totals.brainNotes} notes, ${data.totals.projects} projects`
);
