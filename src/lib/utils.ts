import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn/ui class-merge helper: clsx for conditional classes, tailwind-merge to
// dedupe conflicting Tailwind utilities (last one wins). Used by every ui/*.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
