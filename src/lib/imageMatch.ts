// SERVER ONLY. Recognises our slides in what a creator posted (ticket 04, spec
// Projects/Klar/specs/creator-plattform): ORB feature points (OpenCV as
// WebAssembly) matched between two images, and RANSAC counts how many of the
// matches agree on one geometric mapping. That survives what the plain
// fingerprint did not (test 2026-10-21): cropping, screenshots with a status
// bar, text over the slide, brightness and filters.
//
// Settings measured on 22 of our slides with 9 edits each: at 360 px width and
// 500 points every edited slide found its original, the weakest with 99 agreeing
// points (8 % cropped); slides that were never handed out reached 20 in the
// median. Only truly identical slides (the Basalt card, sources) score high
// across posts, and those are ours anyway. MATCH_INLIERS sits between the two.

import "server-only";
import { createRequire } from "node:module";
import sharp from "sharp";

export const MATCH_INLIERS = 60;
const WIDTH = 360;
const POINTS = 500;

/* eslint-disable @typescript-eslint/no-explicit-any -- opencv.js ships no types */
// The module object is wrapped because it has its own `then`: returned bare from
// an async function, the promise would wait on it forever.
let cvReady: Promise<{ cv: any }> | null = null;
function opencv(): Promise<{ cv: any }> {
  cvReady ??= (async () => {
    // Plain Node require: run through a bundler or loader, the 12 MB file stalls.
    const cv = createRequire(import.meta.url)("@techstark/opencv-js");
    if (!cv.Mat) await new Promise<void>((r) => (cv.onRuntimeInitialized = () => r()));
    return { cv };
  })();
  return cvReady;
}

/** Feature points of one image. Call free() when done: OpenCV memory is manual. */
export interface Features {
  kp: any;
  des: any;
  free(): void;
}

export async function features(image: Buffer): Promise<Features> {
  const { cv } = await opencv();
  const { data, info } = await sharp(image).resize({ width: WIDTH }).grayscale().raw().toBuffer({ resolveWithObject: true });
  const mat = new cv.Mat(info.height, info.width, cv.CV_8UC1);
  mat.data.set(data);
  const orb = new cv.ORB(POINTS);
  const kp = new cv.KeyPointVector();
  const des = new cv.Mat();
  const none = new cv.Mat();
  orb.detectAndCompute(mat, none, kp, des);
  [mat, none, orb].forEach((x) => x.delete());
  return { kp, des, free: () => [kp, des].forEach((x) => x.delete()) };
}

/** How many matched points agree on one mapping from a onto b. */
export async function agreeingPoints(a: Features, b: Features): Promise<number> {
  if (a.des.rows < 10 || b.des.rows < 10) return 0;
  const { cv } = await opencv();
  const matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);
  const knn = new cv.DMatchVectorVector();
  matcher.knnMatch(a.des, b.des, knn, 2);
  const src: number[] = [];
  const dst: number[] = [];
  for (let i = 0; i < knn.size(); i++) {
    const pair = knn.get(i);
    if (pair.size() < 2) continue;
    const [first, second] = [pair.get(0), pair.get(1)];
    if (first.distance < 0.75 * second.distance) {
      const p = a.kp.get(first.queryIdx).pt;
      const q = b.kp.get(first.trainIdx).pt;
      src.push(p.x, p.y);
      dst.push(q.x, q.y);
    }
  }
  [knn, matcher].forEach((x) => x.delete());
  if (src.length / 2 < 8) return 0;
  const s = cv.matFromArray(src.length / 2, 1, cv.CV_32FC2, src);
  const d = cv.matFromArray(dst.length / 2, 1, cv.CV_32FC2, dst);
  const mask = new cv.Mat();
  const h = cv.findHomography(s, d, cv.RANSAC, 5, mask);
  let n = 0;
  for (let i = 0; i < mask.rows; i++) n += mask.data[i] ? 1 : 0;
  [s, d, mask, h].forEach((x) => x.delete());
  return n;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** The best reference for an image: its key and the agreeing points. */
export async function bestMatch<K>(image: Features, refs: Array<{ key: K; f: Features }>): Promise<{ key: K | null; points: number }> {
  let best: { key: K | null; points: number } = { key: null, points: 0 };
  for (const r of refs) {
    const points = await agreeingPoints(image, r.f);
    if (points > best.points) best = { key: r.key, points };
    if (points >= MATCH_INLIERS * 3) break; // clearly this one, no need to look further
  }
  return best;
}
