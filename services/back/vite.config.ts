import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

/**
 * The `@/` alias exists twice - as TypeScript `paths` for compilation, and as
 * `_moduleAliases` for the built output - and the test runner knew neither. Any
 * module importing `@/types` therefore could not be imported from a test at all,
 * which is why every backend test so far uses relative paths only.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
