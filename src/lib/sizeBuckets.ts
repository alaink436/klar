// Follower-count buckets — single source of truth for the outreach + inbox
// size filters. Deliberately client-safe (pure data + a pure function, no
// fetch/secrets) so the inbox client component can import `sizeOf` without
// pulling the server-only outreach store into the client bundle.

export type SizeBucket = "nano" | "micro" | "mid" | "macro";

// [min inclusive, max exclusive); null max = no upper bound.
export const SIZE_BUCKETS: { value: SizeBucket; label: string; range: string; min: number; max: number | null }[] = [
  { value: "nano", label: "Nano", range: "<10k", min: 0, max: 10_000 },
  { value: "micro", label: "Micro", range: "10–50k", min: 10_000, max: 50_000 },
  { value: "mid", label: "Mid", range: "50–500k", min: 50_000, max: 500_000 },
  { value: "macro", label: "Macro", range: "500k+", min: 500_000, max: null },
];

// Map a follower estimate to its bucket; null/0/unknown → null.
export function sizeOf(followers: number | null | undefined): SizeBucket | null {
  if (!followers || followers <= 0) return null;
  for (const b of SIZE_BUCKETS) {
    if (followers >= b.min && (b.max === null || followers < b.max)) return b.value;
  }
  return null;
}
