import { defineConfig } from "vitest/config";

// Resolve "@/..." imports through tsconfig paths, as Next does.
export default defineConfig({ resolve: { tsconfigPaths: true } });
