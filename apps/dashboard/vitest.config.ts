import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite-plus";

/**
 * Test-only configuration.
 *
 * Vitest prefers this file over `vite.config.ts`, which is what we want here:
 * the app's config loads the devtools inspector and TurboConsole, and both keep
 * their own servers open - so a unit test run that had already passed sat for
 * the full 10s close timeout before the process could exit. Neither plugin does
 * anything for a unit test.
 *
 * Only the alias is carried over. Add to this file, not to the app config, when
 * a test needs more.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
