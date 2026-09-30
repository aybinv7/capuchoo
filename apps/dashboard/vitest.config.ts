import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite-plus";

/** Test-only configuration: the unit tests cover pure functions, so no Vue plugin is loaded. */
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
